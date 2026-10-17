import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cookieHeaderOf, keepCookies } from '../../support/drivers/browser/cookie-jar.ts';

describe('Cookie jar of the test browsers', () => {
  test('Given an empty jar, when a Set-Cookie line with attributes is kept, then the jar has the cookie by name without its attributes', () => {
    const jar = new Map<string, string>();

    keepCookies(jar, ['session=abc; Path=/; HttpOnly; SameSite=Lax']);

    assert.deepEqual([...jar], [['session', 'abc']]);
  });

  test('Given a jar with a cookie, when a line sets the same name again, then the new value replaces the old one in its place', () => {
    const jar = new Map([['session', 'first'], ['theme', 'dark']]);

    keepCookies(jar, ['session=second; Path=/']);

    assert.deepEqual([...jar], [['session', 'second'], ['theme', 'dark']]);
  });

  test('Given several lines for one cookie in one answer, when they are kept, then they apply in order and the last one wins', () => {
    const jar = new Map<string, string>();

    keepCookies(jar, ['session=old; Path=/', 'session=; Path=/; Max-Age=0', 'session=new; Path=/']);

    assert.deepEqual([...jar], [['session', 'new']]);
  });

  test('Given a jar with a cookie, when a line has Max-Age=0 in any letter case and at any position, then the cookie leaves the jar and the other cookies stay', () => {
    const lines = ['session=abc; Max-Age=0; Path=/', 'session=abc; Path=/; max-age=0', 'session=abc; HttpOnly; MAX-AGE=0; Path=/'];

    for (const line of lines) {
      const jar = new Map([['session', 'abc'], ['theme', 'dark']]);

      keepCookies(jar, [line]);

      assert.deepEqual([...jar], [['theme', 'dark']], line);
    }
  });

  test('Given a jar with a cookie, when a line gives the cookie an empty value, then the cookie leaves the jar', () => {
    const jar = new Map([['session', 'abc']]);

    keepCookies(jar, ['session=; Path=/']);

    assert.deepEqual([...jar], []);
  });

  test('Given a jar with a cookie, when a line has no cookie name, then the line is skipped and the jar does not change', () => {
    const jar = new Map([['session', 'abc']]);

    keepCookies(jar, ['=value; Path=/', '  =value', '=; Max-Age=0']);

    assert.deepEqual([...jar], [['session', 'abc']]);
  });

  test('Given a line with spaces around the name and the value, when it is kept, then the jar has the name and the value without the spaces', () => {
    const jar = new Map<string, string>();

    keepCookies(jar, ['  session  =  abc  ; Path=/']);

    assert.deepEqual([...jar], [['session', 'abc']]);
  });

  test('Given an empty jar, when its Cookie header is made, then there is no header', () => {
    assert.equal(cookieHeaderOf(new Map()), undefined);
  });

  test('Given a jar with cookies, when its Cookie header is made, then the header has each name=value pair in the order that the jar got them, joined by a semicolon and a space', () => {
    const jar = new Map([['theme', 'dark'], ['session', 'abc']]);

    assert.equal(cookieHeaderOf(jar), 'theme=dark; session=abc');
  });

  test('Given the pairs of a Cookie header, when they are kept as lines, then they seed the jar with each cookie, and the jar gives the same header', () => {
    const jar = new Map<string, string>();

    keepCookies(jar, 'a=1; b=2'.split(';'));

    assert.deepEqual([...jar], [['a', '1'], ['b', '2']]);
    assert.equal(cookieHeaderOf(jar), 'a=1; b=2');
  });
});
