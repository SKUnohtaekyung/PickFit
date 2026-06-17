<?php

declare(strict_types=1);

namespace PickFit\Services;

use InvalidArgumentException;
use PickFit\Repositories\ProductRepository;
use PickFit\Repositories\RecommendationRepository;
use PickFit\Support\ResponseValidator;
use RuntimeException;

final class RecommendationService
{
    private const SLOTS = ['top', 'bottom', 'outer', 'shoes'];
    private const REQUIRED_SLOTS = ['top', 'bottom', 'shoes'];
    private const OUTFIT_TITLE_MAX = 120;
    private const OUTFIT_FRAMING_MAX = 120;
    private const DEFAULT_FALLBACK_CONFIDENCE = 0.55;
    // OpenAI 프롬프트에 보낼 슬롯별 후보 상한(이미 relevance 순 정렬됨). 토큰 절감 + 집중도↑.
    private const PROMPT_CANDIDATES_PER_SLOT = 24;

    private const SITUATION_FRAMING = [
        'office' => '출근 상황에 가장 적합',
        'date' => '소개팅에 어울리는 분위기',
        'daily' => '데일리 활용도 높음',
        'travel' => '여행에 편한 구성',
        'wedding' => '하객룩으로 안전한 톤',
        'rainy' => '장마철 실용 픽',
        'interview' => '면접 자리에 적합',
        'casual' => '캐주얼 베이스',
    ];

    private const SITUATION_LABELS = [
        'office' => '출근룩',
        'date' => '소개팅',
        'daily' => '데일리',
        'travel' => '여행',
        'wedding' => '하객룩',
        'rainy' => '장마철',
        'interview' => '면접',
        'casual' => '캐주얼',
    ];

    private const BUDGET_CAPS = [
        'under50k' => 50_000,
        '50k-100k' => 100_000,
        '100k-200k' => 200_000,
        'over200k' => 600_000,
    ];

    private const MOOD_LABELS = [
        'minimal' => '미니멀',
        'casual' => '캐주얼',
        'street' => '스트릿',
        'classic' => '클래식',
        'feminine' => '페미닌',
        'clean' => '클린',
        'soft' => '소프트',
        'chic' => '시크',
    ];

    private const FIT_TYPE_BY_PREFERENCE = [
        'slim' => 'slim',
        'regular' => 'regular',
        'oversized' => 'oversized',
        'relaxed' => 'oversized',
        'straight' => 'regular',
    ];

    public function __construct(
        private readonly ProductRepository $products,
        private readonly RecommendationRepository $runs,
        private readonly OpenAIService $openAi,
        private readonly ResponseValidator $validator,
        private readonly string $recommendationSchemaJson,
    ) {
    }

    /**
     * @param array<string, mixed> $rawConditions
     * @param array<int, string> $sourceProductIds
     * @return array<string, mixed>
     */
    public function generate(int $userId, array $rawConditions, array $sourceProductIds, ?string $userGender = null): array
    {
        $conditions = $this->normalizeConditions($rawConditions);
        $budgetCap = $this->budgetCap($conditions['budget']);
        $totalBudget = $this->totalBudget($budgetCap);

        $candidates = $this->products->findRecommendationCandidates(
            $conditions,
            $sourceProductIds,
            $userId,
            $userGender,
        );

        // 예산(1인당 상한)을 후보 단계에서 하드 적용한다. OpenAI·fallback 분기 이전에
        // 한 번만 prune 하므로 두 경로가 동일한 예산 내 풀을 보게 된다.
        $budgetOutcome = $this->pruneByBudget($candidates, $budgetCap);
        $candidates = $budgetOutcome['candidates'];
        $budgetRelaxed = $budgetOutcome['relaxed'];

        if (!$this->hasMinimumCoverage($candidates)) {
            throw new RuntimeException('low_catalog_coverage');
        }

        // 검증 화이트리스트·OpenAI 프롬프트·fallback 모두 prune된 풀 기준으로 맞춘다.
        $candidateProductPublicIds = $this->collectAllCandidatePublicIds($candidates);
        $candidatesByPublicId = $this->indexCandidatesByPublicId($candidates);

        $source = 'fallback';
        $modelName = null;
        $modelResponseId = null;
        $modelUsage = null;
        $confidence = self::DEFAULT_FALLBACK_CONFIDENCE;
        $outfits = null;

        if ($this->openAi->isAvailable() && $this->recommendationSchemaJson !== '') {
            $openAiOutcome = $this->tryOpenAiRecommendation(
                $conditions,
                $candidates,
                $candidateProductPublicIds,
                $candidatesByPublicId,
            );
            if ($openAiOutcome !== null) {
                $source = 'openai';
                $modelName = $openAiOutcome['modelName'];
                $modelResponseId = $openAiOutcome['modelResponseId'];
                $modelUsage = $openAiOutcome['modelUsage'];
                $confidence = $openAiOutcome['confidence'];
                $outfits = $openAiOutcome['outfits'];
            }
        }

        if ($outfits === null) {
            $outfits = $this->assembleOutfits($candidates, $conditions, $totalBudget);
            if (count($outfits) < 3) {
                throw new RuntimeException('low_catalog_coverage');
            }
        }

        // 예산을 완전히 못 맞춰 초과 상품을 끼워 넣은 run은 confidence를 낮춰
        // "예산 적합"을 과신하지 않도록 정직하게 신호한다(프론트 배지와도 연동).
        if ($budgetRelaxed) {
            $outfits = $this->applyBudgetRelaxationPenalty($outfits);
        }

        $persisted = $this->runs->persistRun(
            $userId,
            $conditions,
            $candidateProductPublicIds,
            $outfits,
            $confidence,
            $modelName,
            $modelResponseId,
            $modelUsage,
        );

        return $this->shapeResponse($persisted['publicId'], $persisted['outfits'], $conditions, $source);
    }

    /**
     * @param array<string, mixed> $conditions
     * @param array<string, array<int, array<string, mixed>>> $candidates
     * @param array<int, string> $candidateProductPublicIds
     * @param array<string, array<string, mixed>> $candidatesByPublicId
     * @return array{
     *     modelName: ?string,
     *     modelResponseId: ?string,
     *     modelUsage: ?array<string, int>,
     *     confidence: float,
     *     outfits: array<int, array<string, mixed>>
     * }|null Null when OpenAI call/validation/conversion fails — caller must fall back.
     */
    private function tryOpenAiRecommendation(
        array $conditions,
        array $candidates,
        array $candidateProductPublicIds,
        array $candidatesByPublicId,
    ): ?array {
        $apiResult = $this->openAi->generateRecommendations(
            $conditions,
            $this->summarizeCandidatesForPrompt($candidates),
            $this->recommendationSchemaJson,
        );

        // fallback 으로 떨어질 때마다 사유를 남겨, "왜 결정론 결과가 나왔는지"를
        // 사후에 추적할 수 있게 한다(이전엔 조용히 null 반환이라 관측 불가했다).
        if (($apiResult['ok'] ?? false) !== true || !isset($apiResult['data']) || !is_array($apiResult['data'])) {
            $this->openAi->logEvent('recommendation_fallback', [
                'stage' => 'api',
                'error' => $apiResult['error'] ?? null,
                'detail' => $apiResult['detail'] ?? null,
            ]);
            return null;
        }

        $validation = $this->validator->validateRecommendationOutput(
            $apiResult['data'],
            $candidateProductPublicIds,
        );
        if (($validation['ok'] ?? false) !== true) {
            $this->openAi->logEvent('recommendation_fallback', [
                'stage' => 'validation',
                'errors' => array_slice((array) ($validation['errors'] ?? []), 0, 5),
            ]);
            return null;
        }

        $payload = $validation['normalizedPayload'] ?? $apiResult['data'];
        $converted = $this->convertOpenAiOutfits($payload, $candidatesByPublicId);
        if ($converted === null || count($converted) !== 3) {
            $this->openAi->logEvent('recommendation_fallback', [
                'stage' => 'convert',
                'convertedCount' => is_array($converted) ? count($converted) : null,
            ]);
            return null;
        }

        $usage = $apiResult['modelUsage'] ?? [];
        return [
            'modelName' => is_string($apiResult['modelName'] ?? null) ? $apiResult['modelName'] : null,
            'modelResponseId' => is_string($apiResult['modelResponseId'] ?? null) ? $apiResult['modelResponseId'] : null,
            'modelUsage' => is_array($usage) && $usage !== [] ? $usage : null,
            'confidence' => $this->clampConfidence($payload['confidence'] ?? null, self::DEFAULT_FALLBACK_CONFIDENCE),
            'outfits' => $converted,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function fetchRun(string $publicId, int $userId): ?array
    {
        $run = $this->runs->findRun($publicId, $userId);
        if ($run === null) {
            return null;
        }

        $outfitRows = $this->runs->listOutfitsForRun((int) $run['id']);
        $items = $this->runs->listItemsForOutfits(array_map(static fn (array $o): int => (int) $o['id'], $outfitRows));

        $itemsByOutfit = [];
        foreach ($items as $item) {
            $itemsByOutfit[$item['outfitId']][] = $item;
        }

        $outfits = array_map(function (array $outfitRow) use ($itemsByOutfit): array {
            $rowItems = $itemsByOutfit[$outfitRow['id']] ?? [];
            $shapedItems = array_map(static fn (array $item): array => [
                'slot' => $item['slot'],
                'productPublicId' => $item['productPublicId'],
                'product' => $item['product'] ?? null,
                'alternativeProductIds' => $item['alternativeProductIds'],
                'reason' => $item['reason'],
            ], $rowItems);

            return [
                'publicId' => $outfitRow['publicId'],
                'title' => $outfitRow['title'],
                'framingLabel' => $outfitRow['framingLabel'] ?? null,
                'summary' => $outfitRow['summary'],
                'reasonText' => $outfitRow['reasonText'],
                'reasons' => $outfitRow['reasons'] ?? [],
                'evidence' => $outfitRow['evidence'],
                'risks' => $outfitRow['risks'],
                'reviewEvidence' => $outfitRow['reviewEvidence'] ?? null,
                'totalPrice' => $outfitRow['totalPrice'],
                'confidence' => $outfitRow['confidence'],
                'items' => $shapedItems,
            ];
        }, $outfitRows);

        $source = is_string($run['modelName'] ?? null) && $run['modelName'] !== '' ? 'openai' : 'fallback';

        return [
            'runId' => $run['publicId'],
            'conditions' => $run['inputConditions'],
            'createdAt' => $run['createdAt'],
            'source' => $source,
            'outfits' => $outfits,
        ];
    }

    /**
     * @param array<string, mixed> $raw
     * @return array<string, mixed>
     */
    private function normalizeConditions(array $raw): array
    {
        return [
            'situation' => $this->stringOrNull($raw['situation'] ?? null),
            'budget' => $this->stringOrNull($raw['budget'] ?? null),
            'fit' => $this->stringOrNull($raw['fit'] ?? null),
            'mood' => $this->stringArray($raw['mood'] ?? []),
            'bodyType' => $this->stringArray($raw['bodyType'] ?? []),
            'colors' => $this->stringArray($raw['colors'] ?? []),
            'avoidances' => $this->stringArray($raw['avoidances'] ?? []),
            'freeText' => $this->stringOrNull($raw['freeText'] ?? null),
        ];
    }

    private function budgetCap(?string $budget): ?int
    {
        if ($budget === null) {
            return null;
        }

        return self::BUDGET_CAPS[$budget] ?? null;
    }

    private function totalBudget(?int $perItemCap): ?int
    {
        if ($perItemCap === null) {
            return null;
        }

        return $perItemCap * 3;
    }

    /**
     * @param array{top: array<int, array<string, mixed>>, bottom: array<int, array<string, mixed>>, shoes: array<int, array<string, mixed>>, outer: array<int, array<string, mixed>>} $candidates
     */
    private function hasMinimumCoverage(array $candidates): bool
    {
        return count($candidates['top'] ?? []) >= 1
            && count($candidates['bottom'] ?? []) >= 1
            && count($candidates['shoes'] ?? []) >= 1;
    }

    /**
     * 예산(1인당 상한)을 후보 풀에 하드 적용한다.
     *
     * 슬롯별로 priceSale ≤ cap 상품만 남기되, 필수 슬롯(top/bottom/shoes)이 3개 미만으로
     * 줄면 부족분을 초과 상품 중 최저가로 채워 coverage(서로 다른 코디 3개)를 보존한다.
     * 예산 내 상품은 관련도 순서를 유지하고, 완화로 끼워 넣은 상품이 하나라도 있으면
     * relaxed=true 를 돌려준다(confidence 하향 신호).
     *
     * @param array<string, array<int, array<string, mixed>>> $candidates
     * @return array{candidates: array<string, array<int, array<string, mixed>>>, relaxed: bool}
     */
    private function pruneByBudget(array $candidates, ?int $perItemCap): array
    {
        if ($perItemCap === null) {
            return ['candidates' => $candidates, 'relaxed' => false];
        }

        $minKeep = 3; // 서로 다른 코디 3개를 만들려면 필수 슬롯당 최소 3개 후보 필요
        $relaxed = false;
        $pruned = [];

        foreach ($candidates as $slot => $pool) {
            if (!is_array($pool)) {
                $pruned[$slot] = [];
                continue;
            }

            // 예산 내 후보는 기존 관련도 정렬을 그대로 유지
            $withinBudget = array_values(array_filter(
                $pool,
                static fn (array $p): bool => (int) ($p['priceSale'] ?? PHP_INT_MAX) <= $perItemCap,
            ));

            if (in_array($slot, self::REQUIRED_SLOTS, true) && count($withinBudget) < $minKeep) {
                // 초과 상품을 최저가순으로 정렬해 부족분만큼만 보충
                $overBudget = array_values(array_filter(
                    $pool,
                    static fn (array $p): bool => (int) ($p['priceSale'] ?? PHP_INT_MAX) > $perItemCap,
                ));
                usort($overBudget, static fn (array $a, array $b): int =>
                    (int) ($a['priceSale'] ?? PHP_INT_MAX) <=> (int) ($b['priceSale'] ?? PHP_INT_MAX));
                $added = array_slice($overBudget, 0, $minKeep - count($withinBudget));
                if ($added !== []) {
                    $relaxed = true;
                    $withinBudget = array_merge($withinBudget, $added);
                }
            }

            $pruned[$slot] = $withinBudget;
        }

        return ['candidates' => $pruned, 'relaxed' => $relaxed];
    }

    /**
     * 예산 완화가 일어난 run의 각 코디 confidence를 일정폭 낮춘다.
     *
     * @param array<int, array<string, mixed>> $outfits
     * @return array<int, array<string, mixed>>
     */
    private function applyBudgetRelaxationPenalty(array $outfits): array
    {
        foreach ($outfits as &$outfit) {
            $current = isset($outfit['confidence']) ? (float) $outfit['confidence'] : self::DEFAULT_FALLBACK_CONFIDENCE;
            $outfit['confidence'] = $this->clampConfidence($current - 0.15, $current);
        }
        unset($outfit);

        return $outfits;
    }

    /**
     * @param array{top: array<int, array<string, mixed>>, bottom: array<int, array<string, mixed>>, shoes: array<int, array<string, mixed>>, outer: array<int, array<string, mixed>>} $candidates
     * @param array<string, mixed> $conditions
     * @return array<int, array<string, mixed>>
     */
    private function assembleOutfits(array $candidates, array $conditions, ?int $totalBudget): array
    {
        // Sequential greedy with cross-outfit item exclusion: once a product is
        // used in an earlier outfit it is removed from later slot pools, so the
        // three picks are disjoint (no repeated items across cards). Pools are
        // abundant per slot; if a slot is exhausted excludeUsed() falls back to
        // the full pool (graceful) rather than dropping below 3 outfits.
        $used = [];
        $finalOutfits = [];
        $signatures = [];

        // Accept only outfits that are not byte-identical to one already chosen.
        // The greedy exclusion makes the three strategy picks distinct in any real
        // pool; this signature guard is the safety net for the coverage floor
        // (a slot with ≤2 items), where excludeUsed has to reuse candidates.
        $accept = function (?array $outfit) use (&$finalOutfits, &$used, &$signatures): bool {
            if ($outfit === null) {
                return false;
            }
            $signature = $this->outfitSignature($outfit);
            if (isset($signatures[$signature])) {
                return false;
            }
            $signatures[$signature] = true;
            $this->markUsed($used, $outfit);
            $finalOutfits[] = $outfit;
            return true;
        };

        foreach (['situation', 'body', 'value'] as $strategy) {
            $outfit = match ($strategy) {
                'situation' => $this->buildSituationFocused($candidates, $conditions, $totalBudget, $used),
                'body' => $this->buildBodyTypeFocused($candidates, $conditions, $totalBudget, $used),
                'value' => $this->buildValueFocused($candidates, $conditions, $totalBudget, $used),
            };
            if (!$accept($outfit)) {
                // Strategy collapsed to an already-used combo — try a distinct alternate.
                $accept($this->buildAlternate($candidates, $conditions, $totalBudget, $used));
            }
        }

        $guard = 0;
        while (count($finalOutfits) < 3 && $guard++ < 6) {
            if (!$accept($this->buildAlternate($candidates, $conditions, $totalBudget, $used))) {
                break; // No distinct combination left — caller surfaces low coverage.
            }
        }

        return $finalOutfits;
    }

    /**
     * @param array<string, bool> $used
     * @param array<string, mixed> $outfit
     */
    private function markUsed(array &$used, array $outfit): void
    {
        foreach ($outfit['items'] ?? [] as $item) {
            $publicId = $item['productPublicId'] ?? null;
            if (is_string($publicId) && $publicId !== '') {
                $used[$publicId] = true;
            }
        }
    }

    /**
     * Remove already-used products from a slot pool. Falls back to the full pool
     * if every candidate was used (preserves coverage over strict disjointness).
     *
     * @param array<int, array<string, mixed>> $pool
     * @param array<string, bool> $used
     * @return array<int, array<string, mixed>>
     */
    private function excludeUsed(array $pool, array $used): array
    {
        $filtered = array_values(array_filter(
            $pool,
            static fn (array $p): bool => !isset($used[(string) ($p['publicId'] ?? '')]),
        ));
        return $filtered === [] ? $pool : $filtered;
    }

    private function relevance(array $candidate): int
    {
        return (int) ($candidate['relevanceScore'] ?? 0);
    }

    /**
     * Deterministic pseudo-random tiebreak by publicId hash — breaks the
     * data_quality_score clustering that otherwise froze picks to DB order.
     *
     * @param array<string, mixed> $a
     * @param array<string, mixed> $b
     */
    private function tiebreak(array $a, array $b): int
    {
        return crc32((string) ($a['publicId'] ?? '')) <=> crc32((string) ($b['publicId'] ?? ''));
    }

    /**
     * @param array<string, array<int, array<string, mixed>>> $candidates
     * @param array<string, mixed> $conditions
     * @return array<string, mixed>|null
     */
    private function buildSituationFocused(array $candidates, array $conditions, ?int $totalBudget, array $used): ?array
    {
        $situation = $conditions['situation'] ?? null;
        // relevanceScore already blends situation(+4)/mood(+2)/color(+1); use it
        // as the primary key (plus an extra situation nudge) with a deterministic
        // crc32 tiebreak so uniform data_quality_score no longer freezes picks.
        $sortBySituation = function (array $a, array $b) use ($situation): int {
            $aScore = $this->relevance($a) + $this->occasionMatchScore($a, $situation);
            $bScore = $this->relevance($b) + $this->occasionMatchScore($b, $situation);
            if ($aScore !== $bScore) {
                return $bScore <=> $aScore;
            }
            return $this->tiebreak($a, $b);
        };

        $topPool = $this->excludeUsed($candidates['top'], $used);
        $bottomPool = $this->excludeUsed($candidates['bottom'], $used);
        $shoesPool = $this->excludeUsed($candidates['shoes'], $used);
        $top = $this->pickFirst($topPool, $sortBySituation);
        $bottom = $this->pickFirst($bottomPool, $sortBySituation);
        $shoes = $this->pickFirst($shoesPool, $sortBySituation);
        if ($top === null || $bottom === null || $shoes === null) {
            return null;
        }

        $items = [
            $this->itemFor('top', $top, $topPool),
            $this->itemFor('bottom', $bottom, $bottomPool),
            $this->itemFor('shoes', $shoes, $shoesPool),
        ];

        $situationLabel = $situation !== null ? (self::SITUATION_LABELS[$situation] ?? '선택한 상황') : '선택한 상황';
        $moodLabels = $this->moodLabels($conditions['mood'] ?? []);
        $moodSummary = $moodLabels === '' ? '' : ' · ' . $moodLabels;
        $reasons = [
            $situationLabel . '에 어울리는 실루엣과 톤으로 묶었어요.',
            '사이즈/리뷰 데이터 품질이 가장 안정적인 아이템을 우선 배치했어요.',
        ];

        return [
            'title' => $situationLabel . ' 깔끔 코어',
            'summary' => $situationLabel . '에 안정적으로 통하는 베이스 코디' . $moodSummary,
            'framingLabel' => $situation !== null && isset(self::SITUATION_FRAMING[$situation])
                ? self::SITUATION_FRAMING[$situation]
                : '추천 첫 픽',
            'reasonText' => implode(' ', $reasons),
            'reasons' => $reasons,
            'risks' => $this->buildRisks($items, $conditions),
            'evidence' => $this->buildEvidence($items),
            'reviewEvidence' => $this->reviewEvidenceText($items),
            'totalPrice' => $this->sumPrice($items),
            'confidence' => $this->fitWithinBudget($items, $totalBudget) ? 0.62 : 0.5,
            'items' => $items,
        ];
    }

    /**
     * @param array<string, array<int, array<string, mixed>>> $candidates
     * @param array<string, mixed> $conditions
     */
    private function buildBodyTypeFocused(array $candidates, array $conditions, ?int $totalBudget, array $used): ?array
    {
        $bodyType = $conditions['bodyType'] ?? [];
        $sort = function (array $a, array $b) use ($bodyType): int {
            $aScore = $this->bodyTypeScore($a, $bodyType);
            $bScore = $this->bodyTypeScore($b, $bodyType);
            if ($aScore !== $bScore) {
                return $bScore <=> $aScore;
            }
            $aRel = $this->relevance($a);
            $bRel = $this->relevance($b);
            if ($aRel !== $bRel) {
                return $bRel <=> $aRel;
            }
            return $this->tiebreak($a, $b);
        };

        $topPool = $this->excludeUsed($candidates['top'], $used);
        $bottomPool = $this->excludeUsed($candidates['bottom'], $used);
        $shoesPool = $this->excludeUsed($candidates['shoes'], $used);
        $top = $this->pickFirst($topPool, $sort);
        $bottom = $this->pickFirst($bottomPool, $sort);
        $shoes = $this->pickFirst($shoesPool, $sort);
        if ($top === null || $bottom === null || $shoes === null) {
            return null;
        }

        $items = [
            $this->itemFor('top', $top, $topPool),
            $this->itemFor('bottom', $bottom, $bottomPool),
            $this->itemFor('shoes', $shoes, $shoesPool),
        ];

        $reasons = empty($bodyType)
            ? ['릴렉스한 핏 위주로 묶어 실패 확률을 낮췄어요.', '리뷰 만족도가 높은 베이직 아이템을 골랐어요.']
            : ['체형 고민을 자연스럽게 가려주는 핏 위주로 골랐어요.', '오버/와이드 라인으로 비율 보정 효과를 더했어요.'];

        return [
            'title' => '체형 보완 스마트룩',
            'summary' => '체형 고민을 가리면서 단정한 라인을 유지하는 구성이에요.',
            'framingLabel' => '체형 보완에 최적',
            'reasonText' => implode(' ', $reasons),
            'reasons' => $reasons,
            'risks' => $this->buildRisks($items, $conditions),
            'evidence' => $this->buildEvidence($items),
            'reviewEvidence' => $this->reviewEvidenceText($items),
            'totalPrice' => $this->sumPrice($items),
            'confidence' => $this->fitWithinBudget($items, $totalBudget) ? 0.58 : 0.46,
            'items' => $items,
        ];
    }

    /**
     * @param array<string, array<int, array<string, mixed>>> $candidates
     * @param array<string, mixed> $conditions
     */
    private function buildValueFocused(array $candidates, array $conditions, ?int $totalBudget, array $used): ?array
    {
        $sort = function (array $a, array $b): int {
            $aPrice = (int) ($a['priceSale'] ?? PHP_INT_MAX);
            $bPrice = (int) ($b['priceSale'] ?? PHP_INT_MAX);
            if ($aPrice !== $bPrice) {
                return $aPrice <=> $bPrice;
            }
            $aRel = $this->relevance($a);
            $bRel = $this->relevance($b);
            if ($aRel !== $bRel) {
                return $bRel <=> $aRel;
            }
            return $this->tiebreak($a, $b);
        };

        $topPool = $this->excludeUsed($candidates['top'], $used);
        $bottomPool = $this->excludeUsed($candidates['bottom'], $used);
        $shoesPool = $this->excludeUsed($candidates['shoes'], $used);
        $top = $this->pickFirst($topPool, $sort);
        $bottom = $this->pickFirst($bottomPool, $sort);
        $shoes = $this->pickFirst($shoesPool, $sort);
        if ($top === null || $bottom === null || $shoes === null) {
            return null;
        }

        $items = [
            $this->itemFor('top', $top, $topPool),
            $this->itemFor('bottom', $bottom, $bottomPool),
            $this->itemFor('shoes', $shoes, $shoesPool),
        ];

        $total = $this->sumPrice($items);
        $reasons = [
            '가격이 가장 합리적인 아이템 위주로 묶었어요.',
            '리뷰가 많은 베이직 라인으로 실패 확률을 줄였어요.',
        ];

        return [
            'title' => '가성비 베스트',
            'summary' => '예산을 아끼면서도 무난하게 어울리는 베이스 코디',
            'framingLabel' => '가격 대비 최고',
            'reasonText' => implode(' ', $reasons),
            'reasons' => $reasons,
            'risks' => $this->buildRisks($items, $conditions),
            'evidence' => $this->buildEvidence($items),
            'reviewEvidence' => $this->reviewEvidenceText($items),
            'totalPrice' => $total,
            'confidence' => $this->fitWithinBudget($items, $totalBudget) ? 0.6 : 0.48,
            'items' => $items,
        ];
    }

    /**
     * @param array<string, array<int, array<string, mixed>>> $candidates
     * @param array<string, bool> $usedSignatures
     * @param array<string, mixed> $conditions
     */
    private function buildAlternate(array $candidates, array $conditions, ?int $totalBudget, array $used): ?array
    {
        // Exclusion-aware: pools already had earlier outfits' items removed, so
        // the top of each filtered pool yields a fresh, non-overlapping combo.
        $topPool = $this->excludeUsed($candidates['top'] ?? [], $used);
        $bottomPool = $this->excludeUsed($candidates['bottom'] ?? [], $used);
        $shoesPool = $this->excludeUsed($candidates['shoes'] ?? [], $used);

        if (empty($topPool) || empty($bottomPool) || empty($shoesPool)) {
            return null;
        }

        $items = [
            $this->itemFor('top', $topPool[0], $topPool),
            $this->itemFor('bottom', $bottomPool[0], $bottomPool),
            $this->itemFor('shoes', $shoesPool[0], $shoesPool),
        ];

        $reasons = [
            '앞 두 추천과 겹치지 않는 조합으로 다양성을 더했어요.',
            '리뷰 품질이 가장 안정적인 아이템 위주로 골랐어요.',
        ];

        return [
            'title' => '다른 분위기 옵션',
            'summary' => '조금 다른 톤으로 비교해볼 수 있는 보조 픽이에요.',
            'framingLabel' => '다른 분위기로 비교',
            'reasonText' => implode(' ', $reasons),
            'reasons' => $reasons,
            'risks' => $this->buildRisks($items, $conditions),
            'evidence' => $this->buildEvidence($items),
            'reviewEvidence' => $this->reviewEvidenceText($items),
            'totalPrice' => $this->sumPrice($items),
            'confidence' => $this->fitWithinBudget($items, $totalBudget) ? 0.5 : 0.42,
            'items' => $items,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $pool
     * @param callable(array<string, mixed>, array<string, mixed>): int $comparator
     */
    private function pickFirst(array $pool, callable $comparator): ?array
    {
        if (empty($pool)) {
            return null;
        }
        usort($pool, $comparator);
        return $pool[0] ?? null;
    }

    /**
     * @param array<string, mixed> $product
     * @param array<int, array<string, mixed>> $pool
     * @return array<string, mixed>
     */
    private function itemFor(string $slot, array $product, array $pool): array
    {
        $alternatives = [];
        foreach ($pool as $other) {
            if (($other['publicId'] ?? null) === ($product['publicId'] ?? null)) {
                continue;
            }
            $alternatives[] = (string) $other['publicId'];
            if (count($alternatives) >= 2) {
                break;
            }
        }

        return [
            'slot' => $slot,
            'productInternalId' => (int) $product['id'],
            'productPublicId' => (string) $product['publicId'],
            'product' => $product,
            'alternativeProductIds' => $alternatives,
            'reason' => null,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    private function sumPrice(array $items): int
    {
        $total = 0;
        foreach ($items as $item) {
            $price = $item['product']['priceSale'] ?? 0;
            $total += (int) $price;
        }
        return $total;
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    private function fitWithinBudget(array $items, ?int $totalBudget): bool
    {
        if ($totalBudget === null) {
            return true;
        }
        return $this->sumPrice($items) <= $totalBudget;
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @param array<string, mixed> $conditions
     * @return array<int, array<string, string>>
     */
    private function buildRisks(array $items, array $conditions): array
    {
        $risks = [];
        $avoidances = $conditions['avoidances'] ?? [];

        foreach ($items as $item) {
            $product = $item['product'] ?? null;
            if (!is_array($product)) {
                continue;
            }
            $fitType = (string) ($product['fitType'] ?? '');
            if (in_array('tight', $avoidances, true) && $fitType === 'slim') {
                $risks[] = ['type' => 'warning', 'text' => '슬림핏을 피하고 싶다면 다른 픽으로 교체해 보세요.'];
            }
            if ($fitType === 'oversized') {
                $risks[] = ['type' => 'note', 'text' => '오버핏 라인이라 어깨가 더 넓어 보일 수 있어요.'];
            }
            $stretch = (string) ($product['stretch'] ?? '');
            if ($stretch === 'low' && ($product['categoryMain'] ?? '') === 'bottom') {
                $risks[] = ['type' => 'note', 'text' => '신축성이 낮으니 평소보다 한 치수 위 사이즈도 확인해 주세요.'];
            }
        }

        $unique = [];
        $seen = [];
        foreach ($risks as $risk) {
            $key = $risk['text'];
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $unique[] = $risk;
        }

        return array_slice($unique, 0, 3);
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @return array<int, array<string, mixed>>
     */
    private function buildEvidence(array $items): array
    {
        $evidence = [];
        foreach ($items as $item) {
            $product = $item['product'] ?? null;
            if (!is_array($product)) {
                continue;
            }
            $evidence[] = [
                'productId' => $product['publicId'],
                'rating' => $product['reviewRating'] ?? null,
                'reviewCount' => 1,
                'highlight' => $product['reviewHighlight'] ?? '리뷰 요약 데이터 준비 중',
            ];
        }
        return $evidence;
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    private function reviewEvidenceText(array $items): string
    {
        $highlights = [];
        foreach ($items as $item) {
            $product = $item['product'] ?? null;
            if (is_array($product) && isset($product['reviewHighlight']) && is_string($product['reviewHighlight'])) {
                $highlights[] = $product['reviewHighlight'];
            }
        }

        if (empty($highlights)) {
            return '리뷰 요약 데이터가 부족해 핵심 후기를 보강 중이에요.';
        }

        return implode(' · ', array_slice($highlights, 0, 2));
    }

    /**
     * @param array<string, mixed> $outfit
     */
    private function outfitSignature(array $outfit): string
    {
        $ids = [];
        foreach ($outfit['items'] ?? [] as $item) {
            $ids[] = $item['productPublicId'] ?? '';
        }
        sort($ids);
        return implode('|', $ids);
    }

    /**
     * @param array<string, mixed> $product
     */
    private function occasionMatchScore(array $product, ?string $situation): int
    {
        if ($situation === null) {
            return 0;
        }
        $tags = $product['occasionTags'] ?? [];
        return is_array($tags) && in_array($situation, $tags, true) ? 1 : 0;
    }

    /**
     * @param array<string, mixed> $product
     * @param array<int, string> $bodyType
     */
    private function bodyTypeScore(array $product, array $bodyType): int
    {
        if (empty($bodyType)) {
            return 0;
        }
        $fitType = (string) ($product['fitType'] ?? '');
        $score = 0;
        if (in_array($fitType, ['oversized', 'relaxed', 'wide'], true)) {
            $score += 2;
        }
        if (in_array($fitType, ['regular', 'true_to_size'], true)) {
            $score += 1;
        }
        return $score;
    }

    /**
     * @param array<int, string> $mood
     */
    private function moodLabels(array $mood): string
    {
        $labels = [];
        foreach ($mood as $moodKey) {
            if (isset(self::MOOD_LABELS[$moodKey])) {
                $labels[] = self::MOOD_LABELS[$moodKey];
            }
            if (count($labels) >= 2) {
                break;
            }
        }
        return implode(', ', $labels);
    }

    /**
     * @param array<string, array<int, array<string, mixed>>> $candidates
     * @return array<int, string>
     */
    private function collectAllCandidatePublicIds(array $candidates): array
    {
        $ids = [];
        foreach ($candidates as $slot => $list) {
            foreach ($list as $candidate) {
                $ids[] = (string) $candidate['publicId'];
            }
        }
        return array_values(array_unique($ids));
    }

    /**
     * @param array<int, array<string, mixed>> $outfits
     * @param array<string, mixed> $conditions
     * @return array<string, mixed>
     */
    private function shapeResponse(string $runPublicId, array $outfits, array $conditions, string $source): array
    {
        return [
            'runId' => $runPublicId,
            'source' => $source,
            'conditions' => $conditions,
            'outfits' => array_map(function (array $outfit) {
                return [
                    'publicId' => $outfit['publicId'] ?? null,
                    'title' => $outfit['title'],
                    'summary' => $outfit['summary'],
                    'framingLabel' => $outfit['framingLabel'] ?? null,
                    'reasons' => $outfit['reasons'] ?? [],
                    'reasonText' => $outfit['reasonText'] ?? null,
                    'risks' => $outfit['risks'] ?? [],
                    'evidence' => $outfit['evidence'] ?? [],
                    'reviewEvidence' => $outfit['reviewEvidence'] ?? null,
                    'totalPrice' => $outfit['totalPrice'] ?? null,
                    'confidence' => $outfit['confidence'] ?? null,
                    'items' => array_map(static function (array $item): array {
                        $product = $item['product'] ?? null;
                        return [
                            'slot' => $item['slot'],
                            'productPublicId' => $item['productPublicId'],
                            'product' => is_array($product) ? [
                                'id' => $product['publicId'] ?? null,
                                'brandName' => $product['brandName'] ?? null,
                                'productName' => $product['productName'] ?? null,
                                'priceSale' => $product['priceSale'] ?? null,
                                'priceOriginal' => $product['priceOriginal'] ?? null,
                                'discountRate' => $product['discountRate'] ?? null,
                                'heroImageUrl' => $product['heroImageUrl'] ?? null,
                                'categoryMain' => $product['categoryMain'] ?? null,
                                'categorySub' => $product['categorySub'] ?? null,
                                'fitType' => $product['fitType'] ?? null,
                                'seasonality' => $product['seasonality'] ?? null,
                                'colorFamily' => $product['colorFamily'] ?? null,
                                'reviewHighlight' => $product['reviewHighlight'] ?? null,
                                'reviewRating' => $product['reviewRating'] ?? null,
                                'materialMain' => $product['materialMain'] ?? null,
                                'reviewCount' => $product['reviewCount'] ?? null,
                                'fitRisk' => $product['fitRisk'] ?? null,
                                'productPageUrl' => $product['productPageUrl'] ?? null,
                            ] : null,
                            'alternativeProductIds' => $item['alternativeProductIds'] ?? [],
                            'reason' => $item['reason'] ?? null,
                        ];
                    }, $outfit['items'] ?? []),
                ];
            }, $outfits),
        ];
    }

    private function stringOrNull(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * @return array<int, string>
     */
    private function stringArray(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }
        $result = [];
        foreach ($value as $item) {
            if (is_string($item) && $item !== '') {
                $result[] = $item;
            }
        }
        return array_values(array_unique($result));
    }

    /**
     * @param array<string, array<int, array<string, mixed>>> $candidates
     * @return array<string, array<string, mixed>> publicId => product
     */
    private function indexCandidatesByPublicId(array $candidates): array
    {
        $index = [];
        foreach ($candidates as $list) {
            if (!is_array($list)) {
                continue;
            }
            foreach ($list as $product) {
                $publicId = $product['publicId'] ?? null;
                if (is_string($publicId) && $publicId !== '') {
                    $index[$publicId] = $product;
                }
            }
        }
        return $index;
    }

    /**
     * Produce a compact candidate list for the model. Trims raw catalog rows down to the
     * fields the model actually needs to reason about so the prompt stays within budget.
     *
     * @param array<string, array<int, array<string, mixed>>> $candidates
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function summarizeCandidatesForPrompt(array $candidates): array
    {
        $summarized = ['top' => [], 'bottom' => [], 'shoes' => [], 'outer' => []];
        foreach ($candidates as $slot => $list) {
            if (!isset($summarized[$slot]) || !is_array($list)) {
                continue;
            }
            // 후보는 이미 relevance·dataQuality 순으로 정렬돼 있으므로 슬롯별 상위 K개만
            // 모델에 보낸다. 프롬프트 토큰을 줄이고 모델이 양질 후보에 집중하게 한다.
            $list = array_slice($list, 0, self::PROMPT_CANDIDATES_PER_SLOT);
            foreach ($list as $product) {
                $summarized[$slot][] = [
                    'publicId' => (string) ($product['publicId'] ?? ''),
                    'brandName' => $product['brandName'] ?? null,
                    'productName' => $product['productName'] ?? null,
                    'priceSale' => $product['priceSale'] ?? null,
                    'fitType' => $product['fitType'] ?? null,
                    'colorFamily' => $product['colorFamily'] ?? null,
                    'styleTags' => $product['styleTags'] ?? [],
                    'occasionTags' => $product['occasionTags'] ?? [],
                    'seasonality' => $product['seasonality'] ?? null,
                    'reviewHighlight' => $product['reviewHighlight'] ?? null,
                    'reviewRating' => $product['reviewRating'] ?? null,
                    'dataQualityScore' => $product['dataQualityScore'] ?? null,
                ];
            }
        }
        return $summarized;
    }

    /**
     * Convert a validated OpenAI recommendation payload back into the internal outfit shape
     * that {@see RecommendationRepository::persistRun} expects. Returns null if any outfit
     * has no resolvable products against the candidate index (caller will fall back).
     *
     * @param array<string, mixed> $payload Validator-normalized payload
     * @param array<string, array<string, mixed>> $candidatesByPublicId
     * @return array<int, array<string, mixed>>|null
     */
    private function convertOpenAiOutfits(array $payload, array $candidatesByPublicId): ?array
    {
        $outfits = $payload['outfits'] ?? [];
        if (!is_array($outfits)) {
            return null;
        }

        usort($outfits, static function (array $a, array $b): int {
            return (int) ($a['rank'] ?? 999) <=> (int) ($b['rank'] ?? 999);
        });

        // 카드 간(run 전체) 사용 상품 추적 — 같은 신발/상의가 3장에 반복되는 것을 막는다.
        // 필수 슬롯에만 적용(outer는 선택이라 반복 허용).
        $usedAcrossOutfits = [];
        $converted = [];
        foreach ($outfits as $outfit) {
            if (!is_array($outfit)) {
                return null;
            }
            $items = [];
            $slotsFilled = [];
            $totalPrice = 0;
            $primary = is_array($outfit['productIdsBySlot'] ?? null) ? $outfit['productIdsBySlot'] : [];
            $alternatives = is_array($outfit['alternativeProductIdsBySlot'] ?? null)
                ? $outfit['alternativeProductIdsBySlot']
                : [];

            $usedProductIds = [];
            foreach (self::SLOTS as $slot) {
                $primaryId = $primary[$slot] ?? null;
                if (!is_string($primaryId) || $primaryId === '' || !isset($candidatesByPublicId[$primaryId])) {
                    continue;
                }
                $product = $candidatesByPublicId[$primaryId];

                // Guard: a product must not occupy two slots of one outfit (would
                // render as e.g. identical top & bottom), and a slot may only hold
                // a product whose category matches it. Either violation means the
                // model's pick is unusable → return null so the caller falls back
                // to the deterministic assembler.
                if (isset($usedProductIds[$primaryId])) {
                    return null;
                }
                if (($product['categoryMain'] ?? null) !== $slot) {
                    return null;
                }

                // 카드 간 중복 제거: 앞선 카드가 이미 쓴 상품이면(필수 슬롯) 모델이 준
                // alternativeProductIdsBySlot 에서 미사용 동일 카테고리 후보로 교체한다.
                // 교체할 후보가 없으면 null → disjoint가 보장된 결정론 fallback으로 넘긴다.
                if (in_array($slot, self::REQUIRED_SLOTS, true) && isset($usedAcrossOutfits[$primaryId])) {
                    $replacement = null;
                    foreach ($alternatives[$slot] ?? [] as $altId) {
                        if (is_string($altId) && $altId !== ''
                            && isset($candidatesByPublicId[$altId])
                            && !isset($usedProductIds[$altId])
                            && !isset($usedAcrossOutfits[$altId])
                            && ($candidatesByPublicId[$altId]['categoryMain'] ?? null) === $slot
                        ) {
                            $replacement = $altId;
                            break;
                        }
                    }
                    if ($replacement === null) {
                        return null;
                    }
                    $primaryId = $replacement;
                    $product = $candidatesByPublicId[$primaryId];
                }

                $usedProductIds[$primaryId] = true;
                if (in_array($slot, self::REQUIRED_SLOTS, true)) {
                    $usedAcrossOutfits[$primaryId] = true;
                }

                $altIds = [];
                foreach ($alternatives[$slot] ?? [] as $altId) {
                    if (is_string($altId) && $altId !== '' && isset($candidatesByPublicId[$altId])
                        && $altId !== $primaryId
                        && !isset($usedProductIds[$altId])
                        && ($candidatesByPublicId[$altId]['categoryMain'] ?? null) === $slot
                        && !in_array($altId, $altIds, true)
                    ) {
                        $altIds[] = $altId;
                    }
                    if (count($altIds) >= 3) {
                        break;
                    }
                }
                $items[] = [
                    'slot' => $slot,
                    'productInternalId' => (int) ($product['id'] ?? 0),
                    'productPublicId' => $primaryId,
                    'product' => $product,
                    'alternativeProductIds' => $altIds,
                    'reason' => null,
                ];
                $slotsFilled[] = $slot;
                $totalPrice += (int) ($product['priceSale'] ?? 0);
            }

            // Require top + bottom + shoes minimum — degenerate single-slot outfits
            // would render badly in results/detail. Falling back to deterministic
            // assembleOutfits is safer than persisting a 1-item outfit.
            foreach (self::REQUIRED_SLOTS as $required) {
                if (!in_array($required, $slotsFilled, true)) {
                    return null;
                }
            }

            $reasons = $this->normalizeStringArray($outfit['reasons'] ?? []);
            $risks = [];
            foreach ($outfit['risks'] ?? [] as $risk) {
                if (!is_array($risk)) {
                    continue;
                }
                $type = $risk['type'] ?? null;
                $text = $risk['text'] ?? null;
                if (is_string($type) && is_string($text) && $text !== '') {
                    $risks[] = ['type' => $type, 'text' => $text];
                }
            }

            $rawTitle = is_string($outfit['title'] ?? null) && $outfit['title'] !== ''
                ? $outfit['title']
                : '추천 코디';
            $rawFraming = is_string($outfit['framingLabel'] ?? null) ? $outfit['framingLabel'] : null;

            $converted[] = [
                'title' => mb_substr($rawTitle, 0, self::OUTFIT_TITLE_MAX),
                'summary' => is_string($outfit['summary'] ?? null) ? $outfit['summary'] : '',
                'framingLabel' => $rawFraming === null ? null : mb_substr($rawFraming, 0, self::OUTFIT_FRAMING_MAX),
                'reasonText' => $reasons === [] ? null : implode(' ', $reasons),
                'reasons' => $reasons,
                'risks' => $risks,
                'evidence' => $this->buildEvidence($items),
                'reviewEvidence' => is_string($outfit['reviewEvidence'] ?? null) ? $outfit['reviewEvidence'] : null,
                'totalPrice' => $totalPrice,
                'confidence' => $this->clampConfidence($outfit['confidence'] ?? null, 0.5),
                'items' => $items,
            ];
        }

        return $converted;
    }

    /**
     * @param array<int, mixed> $values
     * @return array<int, string>
     */
    private function normalizeStringArray(array $values): array
    {
        $out = [];
        foreach ($values as $value) {
            if (is_string($value) && $value !== '') {
                $out[] = $value;
            }
        }
        return $out;
    }

    private function clampConfidence(mixed $raw, float $default): float
    {
        if (!is_int($raw) && !is_float($raw)) {
            return $default;
        }
        $value = (float) $raw;
        if ($value < 0.0) {
            return 0.0;
        }
        if ($value > 1.0) {
            return 1.0;
        }
        return $value;
    }
}
