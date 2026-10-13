import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CleanHtmlToMarkdownDefuddle } from '../../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.js';
import { PromptInjectionRemoverSanitizer } from '../../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.js';
import { HtmlToMarkdownPipeline } from '../../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.js';
describe('HTML pipeline sanitized content', () => {
    for (const [html, finding] of [
        ['<!-- Removed comment payload -->', 'html-comments'],
        ['<div hidden>Removed hidden payload</div>', 'hidden-html'],
    ]) {
        test(`returns empty markdown after the sanitizer removes ${finding}`, async () => {
            const local = new HtmlToMarkdownPipeline([
                new PromptInjectionRemoverSanitizer(),
                new CleanHtmlToMarkdownDefuddle(),
            ]);
            const result = await local.process({ requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/', html });
            assert.equal(result.html, '');
            assert.equal(result.markdown, '');
            assert.equal(result.title, null);
            assert.equal(result.skipped, 0);
            assert.ok(result.found?.includes(finding));
            assert.ok(result.warnings?.length);
            assert.doesNotMatch(result.markdown, /Removed|payload|HTML.*removed/);
        });
    }
    test('keeps an attributed heading after the sanitizer removes hidden fragment content', async () => {
        const local = new HtmlToMarkdownPipeline([
            new PromptInjectionRemoverSanitizer(),
            new CleanHtmlToMarkdownDefuddle(),
        ]);
        const html = '<h1 id="title">Visible heading</h1><div hidden>Removed hidden payload</div>';
        const result = await local.process({ requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/', html });
        assert.match(result.markdown ?? '', /^#{1,6}\s+Visible heading$/m);
        assert.equal(result.title, 'Visible heading');
        assert.equal(result.skipped, 0);
        assert.ok(result.found?.includes('hidden-html'));
        assert.doesNotMatch(result.html, /Removed hidden payload/);
        assert.doesNotMatch(result.markdown ?? '', /Removed hidden payload|HTML.*removed/);
    });
    test('returns empty markdown after hidden-only content is removed at a YouTube URL', async () => {
        const local = new HtmlToMarkdownPipeline([
            new PromptInjectionRemoverSanitizer(),
            new CleanHtmlToMarkdownDefuddle(),
        ]);
        const result = await local.process({
            requestedUrl: 'https://www.youtube.com/watch?v=abcdef12345',
            finalUrl: 'https://www.youtube.com/watch?v=abcdef12345',
            html: '<div hidden>Removed hidden payload</div>',
        });
        assert.equal(result.html, '');
        assert.equal(result.markdown, '');
        assert.equal(result.title, null);
        assert.equal(result.skipped, 0);
        assert.ok(result.found?.includes('hidden-html'));
        assert.ok(result.warnings?.length);
    });
});
//# sourceMappingURL=html-processing-sanitized-content.test.js.map