import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { processHtml } from '../../../../helpers/process-html.js';
const formatWarning = 'Stripped: Format chars (Cf) — inspect the removed bytes with a hex dump (xxd / od -c), which survives sanitization';
function assertFormatFinding(result) {
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, ['cf-format']);
    assert.deepEqual(result.warnings, [formatWarning]);
}
function assertOneFormatFinding(result) {
    assert.deepEqual(result.found?.filter((finding) => finding === 'cf-format'), ['cf-format']);
    assert.deepEqual(result.warnings?.filter((warning) => warning === formatWarning), [formatWarning]);
}
function substackPage(bodyHtml) {
    const preloadData = JSON.stringify({
        feedData: { initialPost: { post: { body_html: bodyHtml } } },
    });
    const jsonParseArgument = JSON.stringify(preloadData);
    return '<html><head><title>Substack test</title></head><body>'
        + `<script>window._preloads = JSON.parse(${jsonParseArgument});</script>`
        + '</body></html>';
}
describe('Controls in deferred HTML content', () => {
    test('keeps escaped examples visible in Substack body_html without decoding another layer', async () => {
        const result = await processHtml(substackPage('<p>Examples: &amp;#8238; &amp;#x202E; &amp;lt;span&amp;gt;'
            + ' &amp; &copy; &#xZZ; &amp;amp;#x202e;</p>'), 'https://example.substack.com/p/test');
        assert.equal(result.markdown, 'Examples: &#8238; &#x202E; &lt;span&gt; & © &#xZZ; &amp;#x202e;');
        assert.deepEqual(result.found?.filter((finding) => finding === 'cf-format'), []);
        assert.deepEqual(result.warnings?.filter((warning) => warning === formatWarning), []);
    });
    test('removes encoded controls from Substack link and image destinations before URL encoding', async () => {
        const destinations = [
            ['202e', '&#8238;'],
            ['202c', '&#x202c;'],
            ['2066', '&#8294;'],
            ['2069', '&#x2069;'],
        ];
        const bodyHtml = destinations.map(([codePoint, control]) => `<p><a href="/left${control}right">link-${codePoint}</a>`
            + `<img src="/left${control}right" alt="image-${codePoint}"></p>`).join('');
        const result = await processHtml(substackPage(bodyHtml), 'https://example.substack.com/p/test');
        for (const [codePoint] of destinations) {
            const destination = `https://example.substack.com/leftright`;
            assert.ok(result.markdown?.includes(`[link-${codePoint}](${destination})`));
            assert.ok(result.markdown?.includes(`![image-${codePoint}](${destination})`));
        }
        assert.doesNotMatch(result.markdown ?? '', /%E2%80%AE|%E2%80%AC|%E2%81%A6|%E2%81%A9/i);
        assertOneFormatFinding(result);
    });
    for (const [encoding, value] of [
        ['literal', '\u202e'],
        ['decimal', '&#8238;'],
        ['hexadecimal', '&#x202e;'],
    ]) {
        test(`cleans ${encoding} controls from Substack code before choosing its fence`, async () => {
            const bodyHtml = `<pre><code>before\n\`${value}\`\`\n&lt;span hidden&gt;Visible content&lt;/span&gt;\nafter</code></pre>`;
            const result = await processHtml(substackPage(bodyHtml), 'https://example.substack.com/p/test');
            assert.equal(result.markdown, '````\nbefore\n```\n<span hidden>Visible content</span>\nafter\n````');
            assert.equal(result.title, 'Substack test');
            assertOneFormatFinding(result);
        });
    }
    test('preserves contextual Persian and emoji joiners across highlighted spans', async () => {
        const result = await processHtml('<html><head><title>Safe title</title></head><body><main>'
            + '<p>می<span>&#x200c;</span>خواهم</p>'
            + '<pre><code><span>👩</span>&#x200d;<span>💻</span></code></pre>'
            + '</main></body></html>');
        assert.equal(result.markdown, 'می‌خواهم\n\n```\n👩‍💻\n```');
        assert.equal(result.title, 'Safe title');
        assert.equal(result.skipped, 0);
        assert.deepEqual(result.found, []);
        assert.deepEqual(result.warnings, []);
    });
    test('does not use text across br or block boundaries as Persian joiner context', async () => {
        const result = await processHtml('<html><head><title>Safe title</title></head><body><main>'
            + '<p>می<br>&#x200c;خواهم</p>'
            + '<p>می&#x200c;</p><p>&#x200c;خواهم</p>'
            + '</main></body></html>');
        assert.doesNotMatch(result.markdown ?? '', /\u200c/);
        assert.match(result.markdown ?? '', /می/);
        assert.match(result.markdown ?? '', /خواهم/);
        assertFormatFinding(result);
    });
    test('treats an image as a boundary for Persian joiner context', async () => {
        const result = await processHtml('<html><head><title>Safe title</title></head><body><main><p>'
            + 'می<img src="/separator.png" alt="separator">&#x200c;خواهم'
            + '</p></main></body></html>');
        assert.doesNotMatch(result.markdown ?? '', /\u200c/);
        assertFormatFinding(result);
    });
    test('removes controls across inline spans and preserves visible order and formatting', async () => {
        const result = await processHtml('<html><head><title>Safe title</title></head><body><main><p>'
            + 'Start <strong>left&#x202e; &amp; middle</strong> '
            + '<em>right&#x2066; end</em> finish'
            + '</p></main></body></html>');
        assert.equal(result.markdown, 'Start **left & middle** *right end* finish');
        assertFormatFinding(result);
    });
    test('removes and reports isolated joiners', async () => {
        const result = await processHtml('<html><head><title>Safe title</title></head><body><main>'
            + '<p>left&#x200c;right and &#x200d;.</p>'
            + '</main></body></html>');
        assert.equal(result.markdown, 'leftright and.');
        assertFormatFinding(result);
    });
});
//# sourceMappingURL=deferred-html-controls.test.js.map