import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { describe, test } from 'node:test';
import { decodeBasicCredentials } from 'better-auth/oauth2';
import { BetterAuthProvider, type BetterAuthProviderSettings } from '../../../src/auth/local-auth/better-auth/better-auth-provider.ts';
import { CLIENT_ADDRESS_HEADER } from '../../../src/http/client-address.ts';
import { InvalidAccessTokenError } from '../../../src/auth/identity-verifier.ts';
import { AccessTokenSigner, localIssuer, localUserClaims } from './fixtures/local-access-tokens.ts';
import { localSettings, TokenProviderDouble } from './fixtures/token-provider-double.ts';

const resourceServerSecret = 'resource-server-secret';

function verifierWithOwnKey(settings: BetterAuthProviderSettings = localSettings) {
  const signer = new AccessTokenSigner('local-key-1');
  const provider = new TokenProviderDouble(signer.publicKey);
  return { provider, verifier: new BetterAuthProvider(provider.auth, settings), token: signer.sign(localUserClaims()) };
}

// An unexpected failure goes to the operator, so it must not hold the token or the client secret.
function unexpectedFailure(token: string, check: (error: Error) => void = () => {}) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof Error && !(error instanceof InvalidAccessTokenError), inspect(error));
    const report = inspect(error, { depth: Infinity });
    assert.ok(!report.includes(token), 'the error holds the token');
    assert.ok(!report.includes(resourceServerSecret), 'the error holds the client secret');
    check(error);
    return true;
  };
}

describe('BetterAuthProvider token introspection', () => {
  test('Given a token that passes the local checks, when it is verified, then the provider handler gets one introspection request from the resource-server client with Basic credentials, the token form, a JSON accept header, and the loopback client address', async () => {
    const { provider, verifier, token } = verifierWithOwnKey();

    await verifier.verifyAccessToken(token);

    assert.equal(provider.requests.length, 1);
    const [request] = provider.requests;
    assert.equal(request?.method, 'POST');
    assert.equal(request?.url, `${localIssuer}/oauth2/introspect`);
    assert.equal(request?.headers.get('Authorization'), `Basic ${Buffer.from(`resource-server:${resourceServerSecret}`).toString('base64')}`);
    assert.equal(request?.headers.get('Content-Type'), 'application/x-www-form-urlencoded');
    assert.equal(request?.headers.get('Accept'), 'application/json');
    assert.equal(request?.headers.get(CLIENT_ADDRESS_HEADER), '127.0.0.1');
    assert.deepEqual([...request?.form ?? []], [['token', token], ['token_type_hint', 'access_token']]);
  });

  test('Given a resource-server client ID and secret with reserved characters, when a token is verified, then the provider decoder reads the same client ID and secret from the Basic credentials, because each part is form-encoded as RFC 6749 asks', async () => {
    const client = { clientId: 'resource server', clientSecret: 'a+b:c%d' };
    const { provider, verifier, token } = verifierWithOwnKey({ ...localSettings, resourceServerClient: client });

    await verifier.verifyAccessToken(token);

    assert.deepEqual(decodeBasicCredentials(provider.requests[0]?.headers.get('Authorization') ?? ''), client);
  });

  test('Given a valid token that introspection reports inactive, as after its session ended, when it is verified, then it is refused as an invalid token', async () => {
    const { provider, verifier, token } = verifierWithOwnKey();
    provider.answerIntrospection(200, { active: false });

    await assert.rejects(verifier.verifyAccessToken(token), InvalidAccessTokenError);

    assert.equal(provider.requests.length, 1);
  });

  test('Given no resource-server client, when a valid token is verified, then it fails as an unexpected error that tells the operator to run clients register, and the provider gets no introspection request', async () => {
    const { provider, verifier, token } = verifierWithOwnKey({ ...localSettings, resourceServerClient: undefined });

    await assert.rejects(verifier.verifyAccessToken(token), unexpectedFailure(token, (error) => {
      assert.match(error.message, /no resource-server client/i);
      assert.match(error.message, /PUBLIC_BASE_URL/);
      assert.match(error.message, /thermus clients register/);
    }));

    assert.deepEqual(provider.requests, []);
  });

  for (const { label, status, body } of [
    { label: '401 for the client credentials', status: 401, body: { error: 'invalid_client', error_description: 'invalid client credentials' } },
    { label: '500', status: 500, body: { error: 'server_error' } },
    { label: '200 with a body that is not JSON', status: 200, body: 'not json' },
    { label: '200 without an active state', status: 200, body: { token_type: 'Bearer' } },
    { label: '200 with an active state that is not a boolean', status: 200, body: { active: 'true' } },
    { label: '200 with a JSON value that is not an object', status: 200, body: 'null' },
  ]) {
    test(`Given introspection that answers ${label}, when a valid token is verified, then it fails as an unexpected error that names the status`, async () => {
      const { provider, verifier, token } = verifierWithOwnKey();
      provider.answerIntrospection(status, body);

      await assert.rejects(verifier.verifyAccessToken(token), unexpectedFailure(token, (error) => {
        assert.match(error.message, new RegExp(`\\b${status}\\b`));
      }));
    });
  }

  for (const failure of [new Error('database is locked'), new TypeError('Cannot read properties of undefined')]) {
    test(`Given a key set that the provider cannot read (${failure.name}), when a token is verified, then it fails as an unexpected error with the read failure as its cause, and the provider gets no introspection request`, async () => {
      const { provider, verifier, token } = verifierWithOwnKey();
      provider.failures.set('getJwks', failure);

      await assert.rejects(verifier.verifyAccessToken(token), unexpectedFailure(token, (error) => {
        assert.equal(error.cause, failure);
      }));

      assert.deepEqual(provider.requests, []);
    });
  }

  for (const { label, keySet } of [
    { label: 'two keys with the key ID of the token', keySet: (key: unknown) => ({ keys: [key, key] }) },
    { label: 'a malformed key list', keySet: () => ({ keys: 'not a list' }) },
  ]) {
    test(`Given a provider key set with ${label}, when a token is verified, then it fails as an unexpected error, and the provider gets no introspection request`, async () => {
      const { provider, verifier, token } = verifierWithOwnKey();
      provider.keySet = keySet((provider.keySet as { keys: unknown[] }).keys[0]);

      await assert.rejects(verifier.verifyAccessToken(token), unexpectedFailure(token));

      assert.deepEqual(provider.requests, []);
    });
  }
});
