import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { localPagePaths } from '../../../src/interfaces/web/auth/better-auth/local-auth-pages.ts';
import { ProviderDouble } from './fixtures/local-auth-pages-fixtures.ts';

describe('Local page paths', () => {
  test('Given the public base URL http://localhost:8080/, when the page paths are made, then they are /sign-in, /consent, and /authorization-error', () => {
    const paths = localPagePaths('http://localhost:8080/');

    assert.deepEqual(paths, { signIn: '/sign-in', consent: '/consent', authorizationError: '/authorization-error' });
  });

  test('Given a public base URL with the path /thermus/, when the page paths are made, then each page is under that path', () => {
    const paths = localPagePaths('https://example.com/thermus/');

    assert.deepEqual(paths, { signIn: '/thermus/sign-in', consent: '/thermus/consent', authorizationError: '/thermus/authorization-error' });
  });

  test('Given the pages, when they are asked about pathnames, then they handle only the three page paths', () => {
    const pages = new ProviderDouble().pages();

    const handled = ['/sign-in', '/consent', '/authorization-error', '/sign-in/', '/api/auth/sign-in/email', '/', '/mcp'].map((pathname) => pages.handles(pathname));

    assert.deepEqual(handled, [true, true, true, false, false, false, false]);
  });
});
