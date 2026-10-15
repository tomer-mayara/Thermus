import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { decodeHtml } from '../../support/drivers/browser/html-entities.ts';

describe('HTML entities that the test browsers decode', () => {
  test('Given each of the five entities that the pages write, when it is decoded, then it gives its character', () => {
    const entities = ['&amp;', '&lt;', '&gt;', '&quot;', '&#39;'];

    const decoded = entities.map((entity) => decodeHtml(entity));

    assert.deepEqual(decoded, ['&', '<', '>', '"', "'"]);
  });

  test('Given a text with several entities, when it is decoded, then each entity gives its character and the other text stays', () => {
    assert.equal(decodeHtml('a=1&amp;b=2 &lt;Ann&#39;s &quot;team&quot;&gt;'), 'a=1&b=2 <Ann\'s "team">');
  });

  test('Given an entity whose text is also encoded, when it is decoded, then it is decoded one time only', () => {
    assert.equal(decodeHtml('&amp;lt;'), '&lt;');
  });

  test('Given plain text, an unknown named entity, and a numeric entity other than &#39;, when each is decoded, then it stays unchanged', () => {
    for (const text of ['plain text', 'caf&eacute;', '&#40;x&#41;']) {
      assert.equal(decodeHtml(text), text);
    }
  });

  test('Given the empty string, when it is decoded, then it gives the empty string', () => {
    assert.equal(decodeHtml(''), '');
  });
});
