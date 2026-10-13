import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PromptInjectionRemoverSanitizer } from '../../../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.js';
import { createContext } from '../../../../support/html-cleaner-context.js';
const threatUrl = `https://attacker.example/?payload=${'a'.repeat(128)}`;
describe('hidden HTML source and parsed tree handling', () => {
    test('removes hidden document descendants after the source closing tag', async () => {
        for (const tag of ['body', 'html']) {
            for (const prefix of ['', '<span hidden>cut</span>']) {
                const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(`<${prefix}${tag} hidden>secret</${tag}><p>tail secret</p>`));
                assert.equal(result.html, '');
                assert.deepEqual(result.found, ['hidden-html']);
                assert.equal(result.skipped, 0);
                assert.doesNotMatch(result.warnings?.join('\n') ?? '', /scan failed|scan limit/);
            }
        }
    });
    test('removes all hidden form descendants and keeps a visible sibling', async () => {
        for (const prefix of ['', '<span hidden>cut</span>']) {
            for (const visible of ['', '<p>visible</p>']) {
                const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(`<${prefix}form hidden><div>secret</form>tail secret</div>${visible}`));
                assert.equal(result.html, visible);
                assert.deepEqual(result.found, ['hidden-html']);
                assert.equal(result.skipped, 0);
                assert.deepEqual(result.warnings, [
                    `HTML sanitized: ${prefix ? 2 : 1} hidden element(s) removed`,
                ]);
            }
        }
    });
    test('keeps a visible marker and flagged URL outside a formed hidden table', async () => {
        const visible = `<p>[hidden HTML removed] <a href="${threatUrl}">Open</a></p>`;
        const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(`<<span hidden>cut</span>table hidden>${visible}</table>`));
        assert.equal(result.html, visible);
        assert.deepEqual([...result.found ?? []].sort(), ['exfil-urls', 'hidden-html']);
        assert.equal(result.skipped, 0);
        const warnings = result.warnings?.join('\n') ?? '';
        assert.equal(warnings.match(/link to attacker\.example: suspicious query parameter/g)?.length, 1);
        assert.equal(new Set(result.warnings).size, result.warnings?.length);
        assert.doesNotMatch(warnings, /scan failed|scan limit/);
    });
    test('preserves visible text on both sides of hidden table content', async () => {
        const result = await new PromptInjectionRemoverSanitizer().invoke(createContext('<table hidden>😀 [hidden HTML removed]<!-- cut --><tr><td>secret</td></tr> 𐐀 &amp; tail</table>'));
        assert.equal(result.html, '😀 [hidden HTML removed] 𐐀 &amp; tail');
        assert.deepEqual(result.found, ['hidden-html']);
        assert.equal(result.skipped, 0);
        assert.deepEqual(result.warnings, ['HTML sanitized: 1 hidden element(s) removed']);
    });
    test('keeps URL warnings from hidden descendants after a document closing tag', async () => {
        for (const tag of ['body', 'html']) {
            const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(`<<span hidden>cut</span>${tag} hidden>secret</${tag}><p><a href="${threatUrl}">Open</a></p>`));
            assert.equal(result.html, '');
            assert.deepEqual([...result.found ?? []].sort(), ['exfil-urls', 'hidden-html']);
            assert.equal(result.skipped, 0);
            const warnings = result.warnings?.join('\n') ?? '';
            assert.equal(warnings.match(/link to attacker\.example: suspicious query parameter/g)?.length, 1);
            assert.equal(new Set(result.warnings).size, result.warnings?.length);
            assert.doesNotMatch(warnings, /scan failed|scan limit/);
        }
    });
});
//# sourceMappingURL=hidden-html-tree.test.js.map