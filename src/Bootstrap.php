<?php

declare(strict_types=1);

namespace PickFit;

use PickFit\Controllers\CatalogController;
use PickFit\Http\Request;
use PickFit\Http\Response;
use PickFit\Http\Router;
use PickFit\Repositories\ProductRepository;

final class Bootstrap
{
    public function __construct(
        private readonly Config $config,
        private readonly string $publicPath,
    ) {
    }

    public static function create(string $projectRoot): self
    {
        return new self(
            Config::fromEnvironment($projectRoot),
            $projectRoot . DIRECTORY_SEPARATOR . 'public',
        );
    }

    public function handle(Request $request): Response
    {
        date_default_timezone_set($this->config->get('APP_TIMEZONE', 'Asia/Seoul') ?? 'Asia/Seoul');

        $router = new Router();

        $router->get('/api/health', function (array $_): Response {
            return Response::json([
                'ok' => true,
                'app' => 'PickFit',
                'environment' => $this->config->get('APP_ENV', 'local'),
            ]);
        });
        $router->get('/api/products', fn (array $_): Response => $this->catalog()->index($request));
        $router->get('/api/products/{id}', fn (array $params): Response => $this->catalog()->show($params['id']));

        $response = $router->dispatch($request);
        if ($response !== null) {
            return $response;
        }

        if (str_starts_with($request->path(), '/api/')) {
            return Response::json([
                'ok' => false,
                'error' => [
                    'code' => 'not_found',
                    'message' => 'API endpoint not found.',
                ],
            ], 404);
        }

        return Response::file($this->publicPath . DIRECTORY_SEPARATOR . 'app.html', 'text/html; charset=UTF-8');
    }

    private function catalog(): CatalogController
    {
        return new CatalogController(
            new ProductRepository(
                (new Database($this->config))->pdo(),
            ),
        );
    }
}
