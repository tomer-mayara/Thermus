import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.js';
import { HtmlToMarkdownPipeline } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.js';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.js';
test('given text at 11px, 12px, and 13px, when the default pipeline runs, then Markdown keeps only text at or above 12px', async () => {
    const result = await processText('<p>'
        + '<span style="font-size:11px">Below cutoff.</span> '
        + '<span style="font-size:12px">At cutoff.</span> '
        + '<span style="font-size:13px">Above cutoff.</span>'
        + '</p>');
    assert.doesNotMatch(result.markdown ?? '', /Below cutoff/);
    assert.equal(result.markdown, 'At cutoff. Above cutoff.');
    assert.equal(result.removed, 1);
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, ['hidden-html']);
});
test('given a cutoff of 8px, when the pipeline runs, then Markdown removes 7px text and keeps 8px and 11px text', async () => {
    const result = await processText('<p>'
        + '<span style="font-size:7px">Below custom cutoff.</span> '
        + '<span style="font-size:8px">At custom cutoff.</span> '
        + '<span style="font-size:11px">Above custom cutoff.</span>'
        + '</p>', new PromptInjectionRemoverSanitizer({ minTextFontSizePx: 8 }));
    assert.doesNotMatch(result.markdown ?? '', /Below custom cutoff/);
    assert.equal(result.markdown, 'At custom cutoff. Above custom cutoff.');
});
test('given a cutoff of zero, when the pipeline runs, then Markdown keeps small text and removes existing invisible content', async () => {
    const result = await processText('<p>'
        + '<span style="font-size:1px">One pixel.</span> '
        + '<span style="font-size:11px">Eleven pixels.</span> '
        + '<span style="font-size:0">Zero font.</span>'
        + '<span style="font-size:0.001px">Near zero font.</span>'
        + '<span hidden>Hidden attribute.</span>'
        + '</p>', new PromptInjectionRemoverSanitizer({ minTextFontSizePx: 0 }));
    assert.equal(result.markdown, 'One pixel. Eleven pixels.');
});
test('given a small parent with larger child text and an image, when the pipeline runs, then Markdown keeps the child and image', async () => {
    const result = await processText('<p style="font-size:11px">Small parent. '
        + '<span style="font-size:13px">Large child.</span>'
        + '<img src="https://example.com/diagram.png" alt="Diagram">'
        + ' Small parent tail.</p>');
    assert.doesNotMatch(result.markdown ?? '', /Small parent/);
    assert.match(result.markdown ?? '', /Large child\./);
    assert.match(result.markdown ?? '', /!\[Diagram\]\(https:\/\/example\.com\/diagram\.png\)/);
});
test('given inherited and relative font sizes, when the pipeline runs, then Markdown uses resolved pixels for the cutoff', async () => {
    const result = await processText('<style>html { font-size:24px } .small { font-size:11px } </style>'
        + '<p class="small">Small inherited. <span>Small inherited child.</span> '
        + '<span style="font-size:13px">Large override.</span></p>'
        + '<p style="font-size:24px">'
        + '<span style="font-size:0.5em">Em boundary.</span> '
        + '<span style="font-size:49%">Small percent.</span> '
        + '<span style="font-size:0.5rem">Rem boundary.</span> '
        + '<span style="font:9pt serif">Point boundary.</span>'
        + '</p>');
    assert.doesNotMatch(result.markdown ?? '', /Small inherited|Small percent/);
    for (const text of ['Large override.', 'Em boundary.', 'Rem boundary.', 'Point boundary.']) {
        assert.ok(result.markdown?.includes(text));
    }
});
for (const [name, size, scale, below] of [
    ['enlarged', '6', '2', '5.999'],
    ['reduced', '24', '0.5', '23.998'],
]) {
    test(`given ${name} text at and below the effective 12px boundary, when the pipeline runs, then Markdown keeps only the boundary text`, async () => {
        const result = await processText('<p>'
            + `<span style="display:inline-block;font-size:${size}px;transform:scale(${scale})">Effective boundary.</span> `
            + `<span style="display:inline-block;font-size:${below}px;transform:scale(${scale})">Effective below.</span>`
            + '</p>');
        assert.doesNotMatch(result.markdown ?? '', /Effective below/);
        assert.equal(result.markdown, 'Effective boundary.');
    });
}
test('given parent and child scales that cancel, when the pipeline runs, then Markdown keeps restored child text', async () => {
    const result = await processText('<p style="font-size:12px;transform:scale(0.5)">Reduced parent. '
        + '<span style="display:inline-block;transform:scale(2)">Restored child.</span>'
        + ' Reduced parent tail.</p>');
    assert.doesNotMatch(result.markdown ?? '', /Reduced parent/);
    assert.equal(result.markdown, 'Restored child.');
});
test('given tiny and unresolved font sizes or transforms, when the pipeline runs, then Markdown removes only proven small text', async () => {
    const result = await processText('<p>'
        + '<span style="font-size:0.02px">Known tiny.</span>'
        + '<span style="font-size:var(--size)">Unknown font.</span> '
        + '<span style="font-size:calc(6px + 6px)">Unresolved calculation.</span> '
        + '<span style="display:inline-block;font-size:1px;transform:var(--transform)">Unknown transform.</span> '
        + '<span style="display:inline-block;font-size:1px;transform:perspective(100px) rotateY(20deg)">Unknown projection.</span>'
        + '</p>');
    assert.doesNotMatch(result.markdown ?? '', /Known tiny/);
    assert.equal(result.markdown, 'Unknown font. Unresolved calculation. Unknown transform. Unknown projection.');
});
async function processText(body, sanitizer = new PromptInjectionRemoverSanitizer()) {
    const pipeline = new HtmlToMarkdownPipeline([
        sanitizer,
        new CleanHtmlToMarkdownDefuddle(),
    ]);
    return pipeline.process({
        requestedUrl: 'https://example.com/article',
        finalUrl: 'https://example.com/article',
        html: '<!doctype html><html><body><main>' + body + '</main></body></html>',
    });
}
//# sourceMappingURL=small-text-cutoff.test.js.map