import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { CleanHtmlToMarkdownDefuddle } from '../../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.js';
import { createContextForUrl as createContext } from '../../../support/html-cleaner-context.js';
let converter;
beforeEach(() => {
    converter = new CleanHtmlToMarkdownDefuddle();
});
describe('HTML to Markdown code formatting', () => {
    describe('fragment code formatting', () => {
        for (const html of [
            '<pre>first<br>  second</pre>',
            '<pre><code>first<br>  second</code></pre>',
            '<code style="white-space: pre">first<br>  second</code>',
        ]) {
            test(`keeps line breaks in a code fragment: ${html}`, async () => {
                const result = await converter.invoke(createContext(html));
                assert.equal(result.markdown, '```\nfirst\n  second\n```');
            });
        }
        for (const html of [
            '<main><code style="white-space: pre">if ready:\n    run()\nelse:\n    stop()</code></main>',
            '<pre>if ready:\n    run()\nelse:\n    stop()</pre>',
            '<p>Visible before.</p><pre>if ready:\n    run()\nelse:\n    stop()</pre><h2>Visible after.</h2>',
        ]) {
            test(`keeps fenced code and visible content in fragments: ${html}`, async () => {
                const result = await converter.invoke(createContext(html));
                assert.match(result.markdown ?? '', /```\nif ready:\n    run\(\)\nelse:\n    stop\(\)\n```/);
                if (html.includes('Visible before.')) {
                    assert.match(result.markdown ?? '', /Visible before\./);
                    assert.match(result.markdown ?? '', /## Visible after\./);
                }
            });
        }
        test('keeps text around a nested code element in a preformatted fragment', async () => {
            const result = await converter.invoke(createContext('<pre>before\n<code>  middle</code>\nafter</pre>'));
            assert.equal(result.markdown, '```\nbefore\n  middle\nafter\n```');
        });
        for (const style of ['white-space: pre !important', 'WHITE-SPACE: PRE !IMPORTANT']) {
            test(`keeps code fences for CSS whitespace with priority: ${style}`, async () => {
                const result = await converter.invoke(createContext(`<code style="${style}">if ready:\n    run()</code>`));
                assert.equal(result.markdown, '```\nif ready:\n    run()\n```');
            });
        }
    });
    describe('document code formatting', () => {
        test('keeps fenced multiline code from a bare pre element', async () => {
            const html = '<html><head><title>Document code</title></head><body><pre>if ready:\n    run()\nelse:\n    stop()</pre></body></html>';
            const result = await converter.invoke(createContext(html));
            assert.equal(result.title, 'Document code');
            assert.equal(result.markdown, '```\nif ready:\n    run()\nelse:\n    stop()\n```');
        });
        test('keeps fenced multiline code from a standalone styled code element', async () => {
            const html = '<html><head><title>Document code</title></head><body><code style="white-space: pre">if ready:\n    run()\nelse:\n    stop()</code></body></html>';
            const result = await converter.invoke(createContext(html));
            assert.equal(result.title, 'Document code');
            assert.equal(result.markdown, '```\nif ready:\n    run()\nelse:\n    stop()\n```');
        });
    });
});
//# sourceMappingURL=html-to-markdown-code-formatting.test.js.map