import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { processHtml } from '../helpers/process-html.ts';

describe('Images and examples in noscript content', () => {
  test('keeps an escaped image example inside noscript as visible text', async () => {
    const result = await processHtml(
      '<html><head><title>Safe title</title></head><body><figure>'
      + '<noscript>&lt;img src="/image.png" alt="Example: &amp;#x202e;"&gt;</noscript>'
      + '</figure></body></html>',
    );

    assert.match(result.markdown ?? '', /\\<img src="\/image\.png" alt="Example: &#x202e;">/);
    assert.doesNotMatch(result.markdown ?? '', /!\[|\]\(https:\/\/example\.com\/image\.png/);
    assert.equal(result.title, 'Safe title');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.warnings, []);
  });

  test('keeps real images in noscript content supported', async () => {
    const result = await processHtml(
      '<html><head><title>Safe title</title></head><body><figure>'
      + '<noscript><img src="/image.png" alt="Real image"></noscript>'
      + '</figure></body></html>',
    );

    assert.match(result.markdown ?? '', /!\[Real image\]\(https:\/\/example\.com\/image\.png\)/);
  });

  test('keeps a visible escaped image example when noscript also has a real image', async () => {
    const result = await processHtml(
      '<html><head><title>Safe title</title></head><body><figure><noscript>'
      + '<img src="/real.png" alt="Real image">'
      + '&lt;img src="/example.png" alt="Example: &amp;#x202e;"&gt;'
      + '</noscript></figure></body></html>',
    );
    const markdown = result.markdown ?? '';

    assert.equal(markdown.match(/!\[/g)?.length, 1);
    assert.match(markdown, /!\[Real image\]\(https:\/\/example\.com\/real\.png\)/);
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.warnings, []);
    assert.match(markdown, /\\<img src="\/example\.png" alt="Example: &#x202e;">/);
  });

  test('keeps an escaped noscript image nested in code as code text', async () => {
    const result = await processHtml(
      '<html><head><title>Safe title</title></head><body><figure><noscript><code>'
      + '&lt;img src="/image.png" alt=&quot;Example: &amp;#x202e;&quot;&gt;'
      + '</code></noscript></figure></body></html>',
    );

    assert.match(result.markdown ?? '', /`.*img src=.*Example: &#x202e;.*`/);
    assert.doesNotMatch(result.markdown ?? '', /!\[|\]\(https:\/\/example\.com\/image\.png/);
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.warnings, []);
  });
});
