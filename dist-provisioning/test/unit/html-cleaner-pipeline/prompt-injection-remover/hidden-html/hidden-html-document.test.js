import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PromptInjectionRemoverSanitizer } from '../../../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.js';
import { createContext } from '../../../../support/html-cleaner-context.js';
const threatUrl = `https://attacker.example/?payload=${'a'.repeat(128)}`;
const scanFailureWarning = 'HTML scan failed; remaining HTML withheld';
function assertHiddenDocumentRemoved(result) {
    assert.equal(result.html, '');
    assert.equal(result.found?.includes('hidden-html'), true);
    assert.equal(result.skipped, 0);
    assert.equal(result.warnings?.includes(scanFailureWarning), false);
}
describe('hidden HTML document and template handling', () => {
    test('removes a body or html element formed as a hidden element', async () => {
        const sanitizer = new PromptInjectionRemoverSanitizer();
        for (const tag of ['body', 'html']) {
            const result = await sanitizer.invoke(createContext(`<<span hidden>cut</span>${tag} hidden>secret</${tag}>`));
            assertHiddenDocumentRemoved(result);
        }
    });
    test('removes a hidden body without a closing tag', async () => {
        const sanitizer = new PromptInjectionRemoverSanitizer();
        const inputs = [
            '<body hidden>secret',
            '<<span hidden>cut</span>body hidden>secret',
        ];
        for (const html of inputs) {
            const result = await sanitizer.invoke(createContext(html));
            assertHiddenDocumentRemoved(result);
        }
    });
    test('removes body and html elements with inline hidden styles', async () => {
        const sanitizer = new PromptInjectionRemoverSanitizer();
        const inputs = [
            '<body style="display:none">secret</body>',
            '<html style="display:none">secret</html>',
        ];
        for (const html of inputs) {
            const result = await sanitizer.invoke(createContext(html));
            assertHiddenDocumentRemoved(result);
        }
    });
    test('preserves a table after a hidden paragraph before it', async () => {
        const result = await new PromptInjectionRemoverSanitizer().invoke(createContext('<p hidden>secret<table><tr><td>visible</td></tr></table><p>tail</p>'));
        assert.equal(result.html, '<table><tr><td>visible</td></tr></table><p>tail</p>');
    });
    test('withholds HTML when a hidden document element has no source range', async () => {
        const result = await new PromptInjectionRemoverSanitizer().invoke(createContext('<p>[hidden HTML removed]</p><body hidden>secret</body>'));
        assert.equal(result.html, '');
        assert.equal(result.warnings?.filter((warning) => warning === 'HTML scan failed; remaining HTML withheld').length, 1);
        assert.equal(result.found?.includes('hidden-html'), false);
        assert.equal(result.skipped, 0);
    });
    test('removes comments and hidden content from template content', async () => {
        const result = await new PromptInjectionRemoverSanitizer().invoke(createContext('<template><!-- secret --><span hidden>secret</span></template><p>visible</p>'));
        assert.equal(result.html, '<template></template><p>visible</p>');
    });
    test('removes hidden content from a template formed by an earlier removal', async () => {
        const result = await new PromptInjectionRemoverSanitizer().invoke(createContext('<p><<span hidden>cut</span>template><<span hidden>cut</span>span hidden>secret</span></template></p>'));
        assert.equal(result.html, '<p><template></template></p>');
    });
    test('keeps source offsets after nested template content with supplementary characters', async () => {
        const authoredMarker = '[hidden HTML removed]';
        const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(`😀 ${authoredMarker} <template>𐐀<!-- secret --><template><span hidden>secret</span></template></template><p>visible</p>`));
        assert.equal(result.html, `😀 ${authoredMarker} <template>𐐀<template></template></template><p>visible</p>`);
    });
    test('does not expose visible template content from a hidden root', async () => {
        const result = await new PromptInjectionRemoverSanitizer().invoke(createContext('<div hidden><template><p>secret</p></template></div><p>visible</p>'));
        assert.equal(result.html, '<p>visible</p>');
    });
    test('reports a threat URL formed in template content before a later removal', async () => {
        const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(`<template><<span hidden>cut</span>span hidden><<span hidden>cut</span>a href="${threatUrl}">Open</a></span></template><p>visible</p>`));
        assert.equal(result.html, '<template></template><p>visible</p>');
        assert.deepEqual([...result.found ?? []].sort(), ['exfil-urls', 'hidden-html']);
        const warnings = result.warnings?.join('\n') ?? '';
        assert.equal(warnings.match(/link to attacker\.example: suspicious query parameter/g)?.length, 1);
        assert.equal(new Set(result.warnings).size, result.warnings?.length);
    });
    test('reports image and link threat URLs in template content once each', async () => {
        const html = `<template><img src="${threatUrl}"><a href="${threatUrl}">Open</a></template><p>visible</p>`;
        const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));
        assert.equal(result.html, html);
        assert.deepEqual(result.found, ['exfil-urls']);
        const warnings = result.warnings?.join('\n') ?? '';
        assert.equal(warnings.match(/image to attacker\.example: suspicious query parameter/g)?.length, 1);
        assert.equal(warnings.match(/link to attacker\.example: suspicious query parameter/g)?.length, 1);
        assert.equal(new Set(result.found).size, result.found?.length);
        assert.equal(new Set(result.warnings).size, result.warnings?.length);
    });
});
//# sourceMappingURL=hidden-html-document.test.js.map