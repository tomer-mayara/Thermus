import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { processHtml } from '../../../support/in-process/process-html.ts';

function substackPage(bodyHtml: string): string {
  const preloadData = JSON.stringify({
    feedData: { initialPost: { post: { body_html: bodyHtml } } },
  });
  return '<html><head><title>Safe title</title></head><body>'
    + `<script>window._preloads = JSON.parse(${JSON.stringify(preloadData)});</script>`
    + '</body></html>';
}

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

  test('keeps one noscript example through repeated Substack extraction', async () => {
    const result = await processHtml(
      substackPage(
        '<div class="body markup"><figure><img src="/real.png" alt="Real image">'
        + '<noscript><img src="/fallback.png" alt="Fallback image">'
        + '&lt;img src="/example.png" alt="Example: &amp;#x202e;"&gt;'
        + '</noscript></figure></div>',
      ),
      'https://example.substack.com/p/test',
    );
    const markdown = result.markdown ?? '';

    assert.equal(markdown.match(/!\[Real image\]/g)?.length, 1);
    assert.match(markdown, /!\[Real image\]\(https:\/\/example\.substack\.com\/real\.png\)/);
    assert.equal(
      markdown.match(/\\<img src="\/example\.png" alt="Example: &#x202e;">/g)?.length,
      1,
    );
    assert.deepEqual(result.found?.filter((finding) => finding === 'cf-format'), []);
  });

  for (const [caseName, outerImage, imageCount] of [
    ['without an outer image', '', 0],
    ['with an outer image', '<img src="/real.png" alt="Real image">', 1],
  ] as const) {
    test(`keeps a nested noscript example ${caseName}`, async () => {
      const result = await processHtml(
        '<html><head><title>Safe title</title></head><body><figure><noscript>'
        + outerImage
        + '<noscript>&lt;img src="/example.png" alt="Example: &amp;#x202e;"&gt;'
        + '</noscript></noscript></figure></body></html>',
      );
      const markdown = result.markdown ?? '';

      assert.equal(markdown.match(/!\[/g)?.length ?? 0, imageCount);
      if (imageCount === 1) {
        assert.match(markdown, /!\[Real image\]\(https:\/\/example\.com\/real\.png\)/);
      }
      assert.equal(
        markdown.match(/\\<img src="\/example\.png" alt="Example: &#x202e;">/g)?.length,
        1,
      );
      assert.deepEqual(result.found?.filter((finding) => finding === 'cf-format'), []);
    });
  }

  test('keeps picture fallbacks and escaped examples in noscript separate', async () => {
    const result = await processHtml(
      '<html><head><title>Safe title</title></head><body><figure><noscript><picture>'
      + '<source srcset="/wide.png 800w"><img src="/image.png" alt="Real image">'
      + '</picture>&lt;img src="/example.png" alt="Example: &amp;#x202e;"&gt;'
      + '</noscript></figure></body></html>',
    );
    const markdown = result.markdown ?? '';

    assert.equal(markdown.match(/!\[/g)?.length, 1);
    assert.match(markdown, /!\[Real image\]\(https:\/\/example\.com\/image\.png\)/);
    assert.doesNotMatch(markdown, /!\[\]\(https:\/\/example\.com\/wide\.png\)/);
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.warnings, []);
    assert.match(markdown, /\\<img src="\/example\.png" alt="Example: &#x202e;">/);
  });

  test('uses the noscript fallback for a lazy image and keeps escaped examples visible', async () => {
    const result = await processHtml(
      '<html><head><title>Safe title</title></head><body><div>'
      + '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///w==" alt="Real image">'
      + '<noscript><img src="/image.png" alt="Real image">'
      + '&lt;img src="/example.png" alt="Example: &amp;#x202e;"&gt;</noscript>'
      + '</div></body></html>',
    );
    const markdown = result.markdown ?? '';

    assert.equal(markdown.match(/!\[Real image\]/g)?.length, 1);
    assert.match(markdown, /!\[Real image\]\(https:\/\/example\.com\/image\.png\)/);
    assert.doesNotMatch(markdown, /data:image\/gif|https:\/\/example\.com\/example\.png/);
    assert.deepEqual(result.found?.filter((finding) => finding === 'cf-format'), []);
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
