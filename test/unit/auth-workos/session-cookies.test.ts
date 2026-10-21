import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, test } from 'node:test';
import {
  sameSecret,
  sessionCookie,
  signInCookie,
  type SessionEnvelope,
  type SignInEnvelope,
} from '../../../src/accounts/providers/workos/session-cookies.ts';

const password = 'session-cookie-test-password-0123456789';
const otherPassword = 'another-cookie-password-0123456789-abcdef';
const session: SessionEnvelope = { seal: 'Fe26.2*1*sealed-workos-session~2', csrf: 'csrf-token-0123456789', mfa: true };
const signIn: SignInEnvelope = { state: 'state-0123456789', codeVerifier: 'verifier-0123456789', returnTo: '/team/', expiresAt: 1_800_000_000_000 };

// The pair that a browser sends back in its Cookie header for a Set-Cookie value.
function sentBack(setCookie: string): string {
  return setCookie.split(';')[0] ?? '';
}

function valueOf(setCookie: string): string {
  const pair = sentBack(setCookie);
  return pair.slice(pair.indexOf('=') + 1);
}

function withCharacterChanged(value: string, index: number): string {
  const character = value[index] === 'A' ? 'B' : 'A';
  return `${value.slice(0, index)}${character}${value.slice(index + 1)}`;
}

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// When the byte length is not a multiple of 3, the lowest bit of the last character carries no data.
function withLowestBitOfLastCharacterFlipped(value: string): string {
  const index = BASE64URL_ALPHABET.indexOf(value.at(-1) ?? '');
  return `${value.slice(0, -1)}${BASE64URL_ALPHABET[index ^ 1]}`;
}

describe('Sealed cookies of the hosted browser session', () => {
  test('Given a session envelope, when it is sealed, then the Set-Cookie value has the __Host- session name, a versioned value, HttpOnly, Secure, SameSite=Lax, Path=/, and a Max-Age of 30 days, and the cookie that the browser sends back opens to the same envelope', () => {
    const cookie = sessionCookie(password);

    const setCookie = cookie.setCookie(session);

    assert.match(setCookie, /^__Host-thermus-session=v1\.[\w-]+; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=2592000$/);
    assert.deepEqual(cookie.contentOf(sentBack(setCookie)), session);
    assert.equal(setCookie.includes('sealed-workos-session') || setCookie.includes(session.csrf), false, 'the value hides its content');
  });

  test('Given a sign-in envelope, when it is sealed, then the Set-Cookie value has the __Host- sign-in name and a Max-Age of 10 minutes, and it opens to the same envelope', () => {
    const cookie = signInCookie(password);

    const setCookie = cookie.setCookie(signIn);

    assert.match(setCookie, /^__Host-thermus-sign-in=v1\.[\w-]+; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=600$/);
    assert.deepEqual(cookie.contentOf(sentBack(setCookie)), signIn);
  });

  test('Given the same envelope, when it is sealed two times, then the two values differ, because each seal has its own random IV, and both open', () => {
    const cookie = sessionCookie(password);

    const first = cookie.setCookie(session);
    const second = cookie.setCookie(session);

    assert.notEqual(valueOf(first), valueOf(second));
    assert.deepEqual([cookie.contentOf(sentBack(first)), cookie.contentOf(sentBack(second))], [session, session]);
  });

  test('Given each cookie, when it is cleared, then the Set-Cookie value has an empty value, the same attributes, and Max-Age=0', () => {
    assert.equal(sessionCookie(password).clearCookie(), '__Host-thermus-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
    assert.equal(signInCookie(password).clearCookie(), '__Host-thermus-sign-in=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  });

  test('Given a sealed session cookie, when a server with another cookie password reads it, then it gives no content and does not throw', () => {
    const setCookie = sessionCookie(password).setCookie(session);

    assert.equal(sessionCookie(otherPassword).contentOf(sentBack(setCookie)), undefined);
  });

  test('Given a sealed session cookie, when any one character of its value changes, then it gives no content', () => {
    const value = valueOf(sessionCookie(password).setCookie({ seal: 'seal', csrf: 'csrf', mfa: false }));
    const cookie = sessionCookie(password);

    const opened = [...value].map((_, index) => cookie.contentOf(`__Host-thermus-session=${withCharacterChanged(value, index)}`));

    assert.deepEqual(opened.filter((content) => content !== undefined), []);
    assert.deepEqual(cookie.contentOf(`__Host-thermus-session=${value}`), { seal: 'seal', csrf: 'csrf', mfa: false });
  });

  test('Given sealed values of each length class, when only an unused low bit of the last character changes, then the value gives no content, because only the canonical text opens', () => {
    const cookie = sessionCookie(password);
    const values = ['s', 'ss', 'sss'].map((seal) => valueOf(cookie.setCookie({ seal, csrf: 'csrf', mfa: false })));

    const opened = values.map((value) => cookie.contentOf(`__Host-thermus-session=${withLowestBitOfLastCharacterFlipped(value)}`));

    assert.deepEqual(new Set(values.map((value) => Buffer.from(value.slice(3), 'base64url').length % 3)), new Set([0, 1, 2]));
    assert.deepEqual(opened, [undefined, undefined, undefined]);
  });

  test('Given a value sealed for one cookie with the shape of the other, when it is sent as the other cookie, then it gives no content, because the purpose of the cookie is part of the seal', () => {
    const asSession = sessionCookie(password).setCookie(signIn as unknown as SessionEnvelope);
    const asSignIn = signInCookie(password).setCookie(session as unknown as SignInEnvelope);

    assert.equal(signInCookie(password).contentOf(`__Host-thermus-sign-in=${valueOf(asSession)}`), undefined);
    assert.equal(sessionCookie(password).contentOf(`__Host-thermus-session=${valueOf(asSignIn)}`), undefined);
    assert.deepEqual(signInCookie(password).contentOf(sentBack(signInCookie(password).setCookie(signIn))), signIn);
  });

  test('Given values that are not a sealed envelope, when they are read, then each gives no content and none throws', () => {
    const valid = valueOf(sessionCookie(password).setCookie(session));
    const values = [
      '',
      'v1.',
      'v1.AAAA',
      valid.slice(3),
      `v2.${valid.slice(3)}`,
      `${valid}=`,
      `${valid.slice(0, 20)}+${valid.slice(21)}`,
      `"${valid}"`,
      valid.slice(0, 40),
      'v1.%41%41%41%41',
      'Fe26.2*1*not-our-envelope~2',
    ];
    const cookie = sessionCookie(password);

    for (const value of values) assert.equal(cookie.contentOf(`__Host-thermus-session=${value}`), undefined, value);
  });

  test('Given authentic seals of content with another shape, when they are read, then each gives no content', () => {
    const cookie = sessionCookie(password);
    const signInReader = signInCookie(password);
    const sessionShapes: unknown[] = [
      null,
      42,
      'text',
      [session.seal, session.csrf, session.mfa],
      { seal: session.seal, csrf: session.csrf },
      { ...session, extra: 'field' },
      { ...session, mfa: 'true' },
      { ...session, seal: '' },
      { ...session, csrf: '' },
      { ...session, csrf: 7 },
    ];
    const signInShapes: unknown[] = [
      { ...signIn, expiresAt: String(signIn.expiresAt) },
      { ...signIn, state: '' },
      { ...signIn, codeVerifier: undefined },
      { ...signIn, returnTo: 5 },
    ];

    for (const shape of sessionShapes) {
      assert.equal(cookie.contentOf(sentBack(cookie.setCookie(shape as SessionEnvelope))), undefined, JSON.stringify(shape));
    }
    for (const shape of signInShapes) {
      assert.equal(signInReader.contentOf(sentBack(signInReader.setCookie(shape as SignInEnvelope))), undefined, JSON.stringify(shape));
    }
  });

  test('Given Cookie headers, when the session cookie is read, then it is found among other cookies, two cookies with its name give no content, a cookie whose name only starts with its name is not it, and no header gives nothing', () => {
    const cookie = sessionCookie(password);
    const pair = sentBack(cookie.setCookie(session));
    const otherPair = sentBack(cookie.setCookie({ ...session, csrf: 'other-csrf-token' }));

    assert.deepEqual(cookie.contentOf(`theme=dark;${pair} ; __Host-thermus-sign-in=v1.AAAA`), session);
    assert.equal(cookie.contentOf(`${pair}; ${otherPair}`), undefined);
    assert.equal(cookie.contentOf(`${pair}; ${pair}`), undefined);
    assert.equal(cookie.contentOf(`__Host-thermus-session2=${valueOf(pair)}`), undefined);
    assert.equal(cookie.contentOf(null), undefined);
    assert.deepEqual(
      [cookie.isSentIn(null), cookie.isSentIn('theme=dark'), cookie.isSentIn('__Host-thermus-session=broken'), cookie.isSentIn(`${pair}; ${pair}`)],
      [false, false, true, true],
    );
  });

  test('Given a WorkOS seal of 2,500 characters, when the session envelope is sealed with a 43-character CSRF token, then the whole Set-Cookie value stays below the cookie limit of 4,096 bytes', () => {
    const seal = `Fe26.2*1*${'x'.repeat(2_500 - 'Fe26.2*1*~2'.length)}~2`;

    const setCookie = sessionCookie(password).setCookie({ seal, csrf: randomBytes(32).toString('base64url'), mfa: true });

    assert.equal(seal.length, 2_500);
    assert.ok(Buffer.byteLength(setCookie) < 4_096, `the Set-Cookie value has ${Buffer.byteLength(setCookie)} bytes`);
  });

  test('Given two secrets, when they are compared, then only the same text is equal, also with another length or an empty text', () => {
    assert.deepEqual(
      [sameSecret('secret-a', 'secret-a'), sameSecret('secret-a', 'secret-b'), sameSecret('secret', 'secret-a'), sameSecret('', 'secret'), sameSecret('', '')],
      [true, false, false, false, false],
    );
  });
});
