<?php

declare(strict_types=1);

namespace PickFit\Support;

final class FitRisk
{
    /**
     * 리뷰 기반 핏 리스크 밴딩(신규 추천·저장 추천 공통 단일 소스).
     * 리뷰 2건 미만이면 신호 부족으로 '정보부족' 반환.
     */
    public static function band(int $reviewCount, int $smallCount, int $largeCount): string
    {
        if ($reviewCount < 2) {
            return '정보부족';
        }
        // 사이즈 이탈(small+large) 비율로 위험 구간 결정
        $ratio = ($smallCount + $largeCount) / $reviewCount;
        if ($ratio >= 0.5) {
            return '높음';
        }
        if ($ratio >= 0.2) {
            return '중간';
        }
        return '낮음';
    }
}
