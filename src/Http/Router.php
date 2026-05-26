<?php

declare(strict_types=1);

namespace PickFit\Http;

final class Router
{
    /**
     * @var array<string, array<int, array{path: string, handler: callable(array<string, string>): Response}>>
     */
    private array $routes = [];

    /**
     * @param callable(array<string, string>): Response $handler
     */
    public function get(string $path, callable $handler): void
    {
        $this->add('GET', $path, $handler);
    }

    /**
     * @param callable(array<string, string>): Response $handler
     */
    public function post(string $path, callable $handler): void
    {
        $this->add('POST', $path, $handler);
    }

    public function dispatch(Request $request): ?Response
    {
        foreach ($this->routes[$request->method()] ?? [] as $route) {
            $params = $this->match($route['path'], $request->path());

            if ($params !== null) {
                return $route['handler']($params);
            }
        }

        return null;
    }

    /**
     * @param callable(array<string, string>): Response $handler
     */
    private function add(string $method, string $path, callable $handler): void
    {
        $this->routes[$method][] = [
            'path' => $path,
            'handler' => $handler,
        ];
    }

    /**
     * @return array<string, string>|null
     */
    private function match(string $routePath, string $requestPath): ?array
    {
        $routeParts = explode('/', trim($routePath, '/'));
        $requestParts = explode('/', trim($requestPath, '/'));

        if (count($routeParts) !== count($requestParts)) {
            return null;
        }

        $params = [];
        foreach ($routeParts as $index => $routePart) {
            $requestPart = $requestParts[$index];

            if (preg_match('/^\{([A-Za-z_][A-Za-z0-9_]*)}$/', $routePart, $matches) === 1) {
                $params[$matches[1]] = rawurldecode($requestPart);
                continue;
            }

            if ($routePart !== $requestPart) {
                return null;
            }
        }

        return $params;
    }
}
