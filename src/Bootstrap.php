<?php

declare(strict_types=1);

namespace PickFit;

use PickFit\Controllers\CatalogController;
use PickFit\Controllers\AuthController;
use PickFit\Controllers\RecommendationController;
use PickFit\Controllers\UserActionController;
use PickFit\Http\Request;
use PickFit\Http\Response;
use PickFit\Http\Router;
use PickFit\Repositories\CrawlJobRepository;
use PickFit\Repositories\FeedbackRepository;
use PickFit\Repositories\ProductRepository;
use PickFit\Repositories\RecommendationRepository;
use PickFit\Repositories\SavedOutfitRepository;
use PickFit\Repositories\UserRepository;
use PickFit\Services\AuthService;
use PickFit\Services\CrawlerService;
use PickFit\Services\CsrfService;
use PickFit\Services\OpenAIService;
use PickFit\Services\RateLimiter;
use PickFit\Services\RecommendationService;
use PickFit\Services\UrlSafetyService;
use PickFit\Support\ResponseValidator;
use PDOException;

final class Bootstrap
{
    private ?Database $database = null;

    public function __construct(
        private readonly Config $config,
        private readonly string $projectRoot,
        private readonly string $publicPath,
        private readonly string $storagePath,
    ) {
    }

    private function database(): Database
    {
        return $this->database ??= new Database($this->config);
    }

    public static function create(string $projectRoot): self
    {
        return new self(
            Config::fromEnvironment($projectRoot),
            $projectRoot,
            $projectRoot . DIRECTORY_SEPARATOR . 'public',
            $projectRoot . DIRECTORY_SEPARATOR . 'storage',
        );
    }

    public function handle(Request $request): Response
    {
        date_default_timezone_set($this->config->get('APP_TIMEZONE', 'Asia/Seoul') ?? 'Asia/Seoul');

        // Long foreground calls (OpenAI recommendations, Playwright crawl) can run
        // up to OPENAI_TIMEOUT_SECONDS / CRAWL_TIMEOUT_SECONDS. The PHP web SAPI's
        // default 30s max_execution_time would kill the request mid-call — and with
        // display_errors on, the HTML fatal leaks into the body and breaks the JSON
        // response ("Server response was not valid JSON"). Give enough headroom, and
        // route PHP errors to the log instead of the response so replies stay JSON.
        $externalTimeout = max(
            $this->config->openAiTimeoutSeconds(),
            (int) ($this->config->get('CRAWL_TIMEOUT_SECONDS', '45') ?? '45'),
        );
        set_time_limit($externalTimeout + 25);
        ini_set('display_errors', '0');
        ini_set('log_errors', '1');

        $csrf = new CsrfService();

        $router = new Router();

        $router->get('/api/health', function (array $_): Response {
            return Response::json([
                'ok' => true,
                'app' => 'PickFit',
                'environment' => $this->config->get('APP_ENV', 'local'),
            ]);
        });
        $router->get('/api/csrf', fn (array $_): Response => $this->withSession(
            fn (): Response => $this->jsonSuccess([
                'csrfToken' => $csrf->token(),
            ]),
        ));
        $router->post('/api/auth/register', fn (array $_): Response => $this->withCsrfProtection(
            $request,
            $csrf,
            fn (): Response => $this->withAuthRateLimit(
                $request,
                'register',
                fn (): Response => $this->withAuthDatabase(
                    fn (AuthController $auth): Response => $auth->register($request),
                ),
            ),
        ));
        $router->post('/api/auth/login', fn (array $_): Response => $this->withCsrfProtection(
            $request,
            $csrf,
            fn (): Response => $this->withAuthRateLimit(
                $request,
                'login',
                fn (): Response => $this->withAuthDatabase(
                    fn (AuthController $auth): Response => $auth->login($request),
                ),
            ),
        ));
        $router->post('/api/auth/logout', fn (array $_): Response => $this->withCsrfProtection(
            $request,
            $csrf,
            fn (): Response => (new AuthController(new AuthService()))->logout(),
        ));
        $router->get('/api/auth/me', fn (array $_): Response => $this->withSession(
            fn (): Response => (new AuthController(new AuthService()))->me(),
        ));
        // 프로필 편집(닉네임·성별): CSRF + 로그인 필수 + DB 가드.
        $router->post('/api/profile', fn (array $_): Response => $this->withCsrfProtection(
            $request,
            $csrf,
            fn (): Response => $this->withAuthenticatedUser(
                fn (array $sessionUser): Response => $this->withAuthDatabase(
                    fn (AuthController $auth): Response => $auth->updateProfile($request),
                ),
            ),
        ));
        $router->get('/api/products', fn (array $_): Response => $this->withCatalog(
            fn (CatalogController $catalog): Response => $catalog->index($request),
        ));
        $router->get('/api/products/{id}', fn (array $params): Response => $this->withCatalog(
            fn (CatalogController $catalog): Response => $catalog->show($params['id']),
        ));
        $router->post('/api/catalog/analyze-url', fn (array $_): Response => $this->withCsrfProtection(
            $request,
            $csrf,
            fn (): Response => $this->withCrawlRateLimit(
                $request,
                fn (): Response => $this->withAuthenticatedUser(
                    fn (array $sessionUser): Response => $this->withCrawlerCatalog(
                        fn (CatalogController $catalog): Response => $catalog->analyzeUrl($request, $sessionUser),
                    ),
                ),
            ),
        ));
        $router->get('/api/catalog/crawl-jobs/{id}', fn (array $params): Response => $this->withSession(
            fn (): Response => $this->withAuthenticatedUser(
                fn (array $sessionUser): Response => $this->withCrawlerCatalog(
                    fn (CatalogController $catalog): Response => $catalog->showCrawlJob($params['id'], $sessionUser),
                ),
            ),
        ));
        $router->post('/api/recommendations', fn (array $_): Response => $this->withCsrfProtection(
            $request,
            $csrf,
            fn (): Response => $this->withRecommendationRateLimit(
                $request,
                fn (): Response => $this->withAuthenticatedUser(
                    fn (array $sessionUser): Response => $this->withRecommendations(
                        fn (RecommendationController $recommendations): Response
                            => $recommendations->create($request, $sessionUser),
                    ),
                ),
            ),
        ));
        $router->get('/api/recommendations/{id}', fn (array $params): Response => $this->withSession(
            fn (): Response => $this->withAuthenticatedUser(
                fn (array $sessionUser): Response => $this->withRecommendations(
                    fn (RecommendationController $recommendations): Response
                        => $recommendations->show($params['id'], $sessionUser),
                ),
            ),
        ));
        $router->get('/api/saved-outfits', fn (array $_): Response => $this->withSession(
            fn (): Response => $this->withAuthenticatedUser(
                fn (array $sessionUser): Response => $this->withUserActions(
                    fn (UserActionController $actions): Response => $actions->listSaved($sessionUser),
                ),
            ),
        ));
        $router->post('/api/saved-outfits', fn (array $_): Response => $this->withCsrfProtection(
            $request,
            $csrf,
            fn (): Response => $this->withAuthenticatedUser(
                fn (array $sessionUser): Response => $this->withUserActions(
                    fn (UserActionController $actions): Response => $actions->save($request, $sessionUser),
                ),
            ),
        ));
        $router->delete('/api/saved-outfits/{id}', fn (array $params): Response => $this->withCsrfProtection(
            $request,
            $csrf,
            fn (): Response => $this->withAuthenticatedUser(
                fn (array $sessionUser): Response => $this->withUserActions(
                    fn (UserActionController $actions): Response
                        => $actions->deleteSaved($params['id'], $sessionUser),
                ),
            ),
        ));
        $router->post('/api/feedback', fn (array $_): Response => $this->withCsrfProtection(
            $request,
            $csrf,
            fn (): Response => $this->withAuthenticatedUser(
                fn (array $sessionUser): Response => $this->withUserActions(
                    fn (UserActionController $actions): Response => $actions->submitFeedback($request, $sessionUser),
                ),
            ),
        ));

        $response = $router->dispatch($request);
        if ($response !== null) {
            return $response;
        }

        if (str_starts_with($request->path(), '/api/')) {
            return Response::json([
                'ok' => false,
                'error' => [
                    'code' => 'route_not_found',
                    'message' => 'API endpoint not found.',
                ],
            ], 404);
        }

        return Response::file($this->publicPath . DIRECTORY_SEPARATOR . 'app.html', 'text/html; charset=UTF-8');
    }

    /**
     * @param callable(): Response $handler
     */
    private function withSession(callable $handler): Response
    {
        $this->startSession();

        return $handler();
    }

    /**
     * @param callable(): Response $handler
     */
    private function withCsrfProtection(Request $request, CsrfService $csrf, callable $handler): Response
    {
        $this->startSession();

        if (!$csrf->validateRequest($request)) {
            return $this->jsonError('forbidden', 'CSRF token is missing or invalid.', 403);
        }

        return $handler();
    }

    /**
     * @param callable(): Response $handler
     */
    private function withAuthRateLimit(Request $request, string $action, callable $handler): Response
    {
        if (!$this->authRateLimiter()->allow('auth:' . $action . ':' . $request->clientIp())) {
            return $this->jsonError('rate_limited', 'Too many auth attempts. Please wait before trying again.', 429);
        }

        return $handler();
    }

    private function startSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $sessionName = $this->config->get('SESSION_NAME', 'pickfit_session') ?: 'pickfit_session';
        $secureCookie = filter_var($this->config->get('SESSION_SECURE', 'false'), FILTER_VALIDATE_BOOLEAN)
            || !$this->config->isLocal();

        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        session_name($sessionName);
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $secureCookie,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    private function catalog(): CatalogController
    {
        return new CatalogController(
            new ProductRepository(
                $this->database()->pdo(),
            ),
        );
    }

    private function auth(): AuthController
    {
        return new AuthController(
            new AuthService(
                new UserRepository(
                    $this->database()->pdo(),
                ),
            ),
        );
    }

    private function authRateLimiter(): RateLimiter
    {
        return new RateLimiter(
            $this->storagePath . DIRECTORY_SEPARATOR . 'rate-limits',
            max(0, (int) ($this->config->get('RATE_LIMIT_AUTH_PER_HOUR', '20') ?? '20')),
            3600,
        );
    }

    private function recommendationRateLimiter(): RateLimiter
    {
        return new RateLimiter(
            $this->storagePath . DIRECTORY_SEPARATOR . 'rate-limits',
            max(0, (int) ($this->config->get('RATE_LIMIT_RECOMMEND_PER_HOUR', '20') ?? '20')),
            3600,
        );
    }

    /**
     * @param callable(): Response $handler
     */
    private function withRecommendationRateLimit(Request $request, callable $handler): Response
    {
        if (!$this->recommendationRateLimiter()->allow('rec:' . $request->clientIp())) {
            return $this->jsonError('rate_limited', 'Too many recommendation requests. Please wait before trying again.', 429);
        }
        return $handler();
    }

    private function crawlRateLimiter(): RateLimiter
    {
        return new RateLimiter(
            $this->storagePath . DIRECTORY_SEPARATOR . 'rate-limits',
            max(0, (int) ($this->config->get('RATE_LIMIT_CRAWL_PER_HOUR', '10') ?? '10')),
            3600,
        );
    }

    /**
     * @param callable(): Response $handler
     */
    private function withCrawlRateLimit(Request $request, callable $handler): Response
    {
        if (!$this->crawlRateLimiter()->allow('crawl:' . $request->clientIp())) {
            return $this->jsonError('rate_limited', 'URL 분석 요청이 많아요. 잠시 후 다시 시도해 주세요.', 429);
        }
        return $handler();
    }

    /**
     * @param callable(array<string, mixed>): Response $handler
     */
    private function withAuthenticatedUser(callable $handler): Response
    {
        $this->startSession();
        $sessionUser = $_SESSION['auth_user'] ?? null;
        if (!is_array($sessionUser) || !isset($sessionUser['userId'])) {
            return $this->jsonError('unauthenticated', 'Login required.', 401);
        }
        return $handler($sessionUser);
    }

    private function recommendations(): RecommendationController
    {
        $pdo = $this->database()->pdo();
        return new RecommendationController(
            new RecommendationService(
                new ProductRepository($pdo),
                new RecommendationRepository($pdo),
                $this->openAiService(),
                new ResponseValidator(),
                $this->loadSchema('recommendation'),
            ),
        );
    }

    private function openAiService(): OpenAIService
    {
        $caCertPath = $this->storagePath . DIRECTORY_SEPARATOR . 'certs' . DIRECTORY_SEPARATOR . 'cacert.pem';
        return new OpenAIService(
            $this->config,
            $this->projectRoot . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'Support' . DIRECTORY_SEPARATOR . 'prompts',
            $this->storagePath . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'openai',
            is_file($caCertPath) ? $caCertPath : null,
        );
    }

    private function loadSchema(string $name): string
    {
        $path = $this->projectRoot
            . DIRECTORY_SEPARATOR . 'src'
            . DIRECTORY_SEPARATOR . 'Support'
            . DIRECTORY_SEPARATOR . 'schemas'
            . DIRECTORY_SEPARATOR . $name . '.schema.json';
        if (!is_file($path)) {
            return '';
        }
        $content = @file_get_contents($path);
        return is_string($content) ? $content : '';
    }

    /**
     * @param callable(RecommendationController): Response $handler
     */
    private function withRecommendations(callable $handler): Response
    {
        try {
            return $handler($this->recommendations());
        } catch (PDOException) {
            return $this->jsonError(
                'database_unavailable',
                'Recommendation database is unavailable. Start MySQL and apply the migration files.',
                503,
            );
        }
    }

    private function userActions(): UserActionController
    {
        $pdo = $this->database()->pdo();
        return new UserActionController(
            new SavedOutfitRepository($pdo),
            new FeedbackRepository($pdo),
        );
    }

    /**
     * @param callable(UserActionController): Response $handler
     */
    private function withUserActions(callable $handler): Response
    {
        try {
            return $handler($this->userActions());
        } catch (PDOException) {
            return $this->jsonError(
                'database_unavailable',
                'User action database is unavailable. Start MySQL and apply the migration files.',
                503,
            );
        }
    }

    /**
     * @param array<string, mixed> $data
     */
    private function jsonSuccess(array $data, int $status = 200): Response
    {
        return Response::json([
            'ok' => true,
            'data' => $data,
            'meta' => $this->meta(),
        ], $status);
    }

    private function jsonError(string $code, string $message, int $status): Response
    {
        return Response::json([
            'ok' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
            'meta' => $this->meta(),
        ], $status);
    }

    /**
     * @return array<string, string>
     */
    private function meta(): array
    {
        return [
            'requestId' => 'req_' . bin2hex(random_bytes(8)),
            'serverTime' => date(DATE_ATOM),
        ];
    }

    /**
     * @param callable(CatalogController): Response $handler
     */
    private function withCatalog(callable $handler): Response
    {
        try {
            return $handler($this->catalog());
        } catch (PDOException) {
            return Response::json([
                'ok' => false,
                'error' => [
                    'code' => 'database_unavailable',
                    'message' => 'Catalog database is unavailable. Start MySQL and apply the migration and seed files.',
                ],
            ], 503);
        }
    }

    private function crawlerCatalog(): CatalogController
    {
        $pdo = $this->database()->pdo();
        $products = new ProductRepository($pdo);
        $crawler = new CrawlerService(
            new UrlSafetyService(),
            new CrawlJobRepository($pdo),
            $products,
            $this->config,
            $this->projectRoot,
            $this->storagePath,
            $this->openAiService(),
            new ResponseValidator(),
            $this->loadSchema('product_extraction'),
        );
        return new CatalogController($products, $crawler);
    }

    /**
     * @param callable(CatalogController): Response $handler
     */
    private function withCrawlerCatalog(callable $handler): Response
    {
        try {
            return $handler($this->crawlerCatalog());
        } catch (PDOException) {
            return $this->jsonError(
                'database_unavailable',
                'Crawl database is unavailable. Start MySQL and apply the migration files.',
                503,
            );
        }
    }

    /**
     * @param callable(AuthController): Response $handler
     */
    private function withAuthDatabase(callable $handler): Response
    {
        try {
            return $handler($this->auth());
        } catch (PDOException) {
            return $this->jsonError(
                'database_unavailable',
                'Auth database is unavailable. Start MySQL and apply the migration files.',
                503,
            );
        }
    }
}
