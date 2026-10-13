import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PromptInjectionRemoverSanitizer } from '../../../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.js';
import { createContext } from '../../../../support/html-cleaner-context.js';
test('counts independent hidden targets and comments, excluding their covered descendants', async () => {
    const input = createContext('<div hidden><span hidden>Child</span><!-- Covered --></div>'
        + '<span hidden>Sibling</span><!-- First --><!-- Second -->', {
        removed: 7, skipped: 3, found: ['hidden-html'], warnings: ['Existing warning'],
        markdown: 'Existing markdown', title: 'Existing title',
    });
    Object.freeze(input.found);
    Object.freeze(input.warnings);
    Object.freeze(input);
    const original = structuredClone(input);
    const sanitizer = new PromptInjectionRemoverSanitizer();
    const result = await sanitizer.invoke(input);
    const repeated = await sanitizer.invoke(result);
    assert.equal(result.html, '');
    assert.equal(result.removed, 11);
    assert.equal(result.skipped, 3);
    assert.deepEqual(result.found, ['hidden-html', 'html-comments']);
    assert.equal(result.warnings?.[0], 'Existing warning');
    assert.deepEqual(repeated, result);
    assert.deepEqual(input, original);
    assert.equal(result.markdown, input.markdown);
    assert.equal(result.title, input.title);
});
test('counts an authored hidden source once when the parser creates multiple nodes', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext('<p><b hidden>A<p>B</b>C'));
    assert.equal(result.html, '<p><p>C');
    assert.equal(result.removed, 1);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.deepEqual(result.warnings, ['HTML sanitized: 1 hidden element(s) removed']);
});
test('does not count an implied hidden element without removed source content', async () => {
    const html = '<style>body{display:none}</style>';
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));
    assert.equal(result.html, html);
    assert.equal(result.removed, 0);
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, []);
});
test('counts hidden text runs and replaced content independently', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext('<div style="font-size:0"><b>First</b><b>Second</b><input style="visibility:hidden" value="Hidden"></div>'));
    assert.equal(result.html, '<div style=""><b></b><b></b></div>');
    assert.equal(result.removed, 3);
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, ['hidden-html']);
});
test('keeps categories and warnings unique across fresh inputs and repeated stages', async () => {
    const sanitizer = new PromptInjectionRemoverSanitizer();
    const first = await sanitizer.invoke(createContext('<p hidden>First</p><script>Visible script</script>'));
    const input = { ...first, html: '<p hidden>Second</p><script>Visible script</script>' };
    const result = await sanitizer.invoke(input);
    assert.equal(result.removed, 2);
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.deepEqual(result.warnings, first.warnings);
    assert.deepEqual(await sanitizer.invoke(result), result);
});
//# sourceMappingURL=sanitizer-counters.test.js.map