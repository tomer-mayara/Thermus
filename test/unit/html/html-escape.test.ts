import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { escapeHtml } from '../../../src/interfaces/web/html-escape.ts';
import { decodeHtml } from '../../support/drivers/browser/html-entities.ts';

describe('HTML escape of the product pages', () => {
  test('Given each of the five characters that the pages escape, when it is escaped, then it gives its entity', () => {
    const characters = ['&', '<', '>', '"', "'"];

    const escaped = characters.map((character) => escapeHtml(character));

    assert.deepEqual(escaped, ['&amp;', '&lt;', '&gt;', '&quot;', '&#39;']);
  });

  test('Given a text with several of these characters, when it is escaped, then each character gives its entity and the other text stays', () => {
    assert.equal(escapeHtml('a=1&b=2 <Ann\'s "team">'), 'a=1&amp;b=2 &lt;Ann&#39;s &quot;team&quot;&gt;');
  });

  // The escape does not look for entities. Each caller escapes a value one time only.
  test('Given a text that already holds an entity, when it is escaped, then the entity is escaped again', () => {
    assert.equal(escapeHtml('&lt;'), '&amp;lt;');
  });

  test('Given plain text, also text with a slash, a backtick, an equals sign, or a non-ASCII character, when each is escaped, then it stays unchanged', () => {
    for (const text of ['plain text', '/team/login', '`code`', 'name=value', 'café', '😀']) {
      assert.equal(escapeHtml(text), text);
    }
  });

  test('Given the empty string, when it is escaped, then it gives the empty string', () => {
    assert.equal(escapeHtml(''), '');
  });

  test('Given a text with all five characters, when it is escaped and then decoded by the test browsers, then the round trip gives the input', () => {
    const text = 'Q&A: <b title="Ann\'s">team</b>';

    assert.equal(decodeHtml(escapeHtml(text)), text);
  });
});
