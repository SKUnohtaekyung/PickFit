<?php

declare(strict_types=1);

namespace PickFit\Tests\Feature;

use PickFit\Tests\Support\FeatureTestCase;

final class AuthFlowTest extends FeatureTestCase
{
    public function testMeWithoutSessionReturns401(): void
    {
        $resp = $this->http->get('/api/auth/me');

        $this->assertSame(401, $resp['status']);
        $this->assertSame('unauthenticated', $resp['body']['error']['code'] ?? null);
    }

    public function testRegisterWithoutCsrfReturns403(): void
    {
        // Skip fetchCsrf to verify the middleware actually blocks unauth-CSRF.
        $resp = $this->http->post('/api/auth/register', [
            'email' => $this->uniqueEmail('feature-test-auth'),
            'password' => 'X12345!',
            'displayName' => 'No CSRF',
        ]);

        $this->assertSame(403, $resp['status']);
        $this->assertSame('forbidden', $resp['body']['error']['code'] ?? null);
    }

    public function testRegisterMeLogoutLoginCycle(): void
    {
        $email = $this->uniqueEmail('feature-test-auth');
        $password = 'TestPass!23';

        $csrf = $this->http->fetchCsrf();
        $this->assertNotEmpty($csrf);

        // Register
        $register = $this->http->post('/api/auth/register', [
            'email' => $email,
            'password' => $password,
            'displayName' => 'Auth Cycle',
        ]);
        $this->assertSame(201, $register['status']);
        $this->assertTrue($register['body']['ok'] ?? false);
        $this->assertSame($email, $register['body']['data']['user']['email'] ?? null);

        // me — should be the just-registered user
        $me1 = $this->http->get('/api/auth/me');
        $this->assertSame(200, $me1['status']);
        $this->assertSame($email, $me1['body']['data']['user']['email'] ?? null);

        // Logout
        $this->http->fetchCsrf();
        $logout = $this->http->post('/api/auth/logout');
        $this->assertSame(200, $logout['status']);

        // me — now unauthenticated
        $me2 = $this->http->get('/api/auth/me');
        $this->assertSame(401, $me2['status']);

        // Login again with same credentials
        $this->http->fetchCsrf();
        $login = $this->http->post('/api/auth/login', [
            'email' => $email,
            'password' => $password,
        ]);
        $this->assertSame(200, $login['status']);
        $this->assertSame($email, $login['body']['data']['user']['email'] ?? null);

        // me — authenticated again, same user
        $me3 = $this->http->get('/api/auth/me');
        $this->assertSame(200, $me3['status']);
        $this->assertSame($email, $me3['body']['data']['user']['email'] ?? null);
    }

    public function testDuplicateRegistrationReturns422ValidationFailed(): void
    {
        $email = $this->uniqueEmail('feature-test-auth');
        $password = 'TestPass!23';

        $this->http->fetchCsrf();
        $first = $this->http->post('/api/auth/register', [
            'email' => $email,
            'password' => $password,
            'displayName' => 'Dup',
        ]);
        $this->assertSame(201, $first['status']);

        $this->http->fetchCsrf();
        $second = $this->http->post('/api/auth/register', [
            'email' => $email,
            'password' => $password,
            'displayName' => 'Dup2',
        ]);
        $this->assertSame(422, $second['status']);
        $this->assertSame('validation_failed', $second['body']['error']['code'] ?? null);
    }

    public function testWrongPasswordAndUnknownEmailReturnIdenticalErrors(): void
    {
        // Security property under test: an attacker probing for valid emails
        // cannot distinguish "user exists but password is wrong" from "user
        // does not exist". Both flows must return the exact same status, code,
        // and message — anything else enables user enumeration.

        $existingEmail = $this->uniqueEmail('feature-test-auth');
        $this->http->fetchCsrf();
        $this->http->post('/api/auth/register', [
            'email' => $existingEmail,
            'password' => 'CorrectHorse42!',
            'displayName' => 'Enumeration Probe',
        ]);
        $this->http->post('/api/auth/logout');

        // Case A: real email, wrong password
        $this->http->fetchCsrf();
        $wrongPassword = $this->http->post('/api/auth/login', [
            'email' => $existingEmail,
            'password' => 'definitely-wrong',
        ]);

        // Case B: email that was never registered
        $this->http->fetchCsrf();
        $unknownEmail = $this->http->post('/api/auth/login', [
            'email' => 'nonexistent-' . bin2hex(random_bytes(4)) . '@nowhere.test',
            'password' => 'anything',
        ]);

        $this->assertSame(401, $wrongPassword['status']);
        $this->assertSame($wrongPassword['status'], $unknownEmail['status'], 'status must match');
        $this->assertSame(
            $wrongPassword['body']['error']['code'] ?? null,
            $unknownEmail['body']['error']['code'] ?? null,
            'error code must match (user enumeration leak)'
        );
        $this->assertSame(
            $wrongPassword['body']['error']['message'] ?? null,
            $unknownEmail['body']['error']['message'] ?? null,
            'error message must match (user enumeration leak)'
        );
    }
}
