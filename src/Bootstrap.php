<?php

declare(strict_types=1);

namespace PickFit;

use PickFit\Controllers\CatalogController;
use PickFit\Controllers\AuthController;
use PickFit\Http\Request;
use PickFit\Http\Response;
use PickFit\Http\Router;
use PickFit\Repositories\ProductRepository;
use PickFit\Repositories\UserRepository;
use PickFit\Services\AuthService;
use PickFit\Services\CsrfService;
use PickFit\Services\RateLimiter;
use PDOException;

final class Bootstrap
{
    public function __construct(
        private readonly Config $config,
        private readonly string $publicPath,
        private readonly string $storagePath,
    ) {
    }

    public static function create(string $projectRoot): self
    {
        return new self(
            Config::fromEnvironment($projectRoot),
            $projectRoot . DIRECTORY_SEPARATOR . 'public',
            $projectRoot . DIRECTORY_SEPARATOR . 'storage',
        );
    }

    public function handle(Request $request): Response
    {
        date_default_timezone_set($this->config->get('APP_TIMEZONE', 'Asia/Seoul') ?? 'Asia/Seoul');

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
        $router->get('/api/products', fn (array $_): Response => $this->withCatalog(
            fn (CatalogController $catalog): Response => $catalog->index($request),
        ));
        $router->get('/api/products/{id}', fn (array $params): Response => $this->withCatalog(
            fn (CatalogController $catalog): Response => $catalog->show($params['id']),
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
                (new Database($this->config))->pdo(),
            ),
        );
    }

    private function auth(): AuthController
    {
        return new AuthController(
            new AuthService(
                new UserRepository(
                    (new Database($this->config))->pdo(),
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
