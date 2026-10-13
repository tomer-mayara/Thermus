import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyLayer1 } from 'agent-input-sanitizer';
const cases = [
    ['SGR before the same visible letter', '\u001b[31mmain', 'main'],
    ['OSC before the same visible word', '\u001b]0;hello\u0007hello', 'hello'],
    ['ANSI exposed by another removal', '\u001b\u001b[32m[0mmain', 'main'],
    ['ANSI split by an invisible character', '\u001b\u200b[31mmain', 'main'],
    ['residual control introducer', '\u001b[', '['],
    ['supplementary text and invisible characters', '😀left\u202eright', '😀leftright'],
    ['contextual joiners and isolated joiners', 'می\u200cخواهم x\u200dy', 'می\u200cخواهم xy'],
    ['leading BOM and interior BOM', '\ufeffleft\ufeffright', '\ufeffleftright'],
    ['emoji tags and an isolated tag', '🏴\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}x\u{e0061}', '🏴\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}x'],
];
for (const [name, input, expected] of cases) {
    test(`sanitizer reports deletion positions for ${name}`, () => {
        const retained = Array.from({ length: input.length }, (_, index) => index);
        const onDelete = (ranges) => {
            for (const range of [...ranges].reverse()) {
                assert.ok(range.start >= 0 && range.end <= retained.length);
                assert.ok(range.end > range.start);
                retained.splice(range.start, range.end - range.start);
            }
        };
        const result = applyLayer1(input, onDelete);
        assert.deepEqual(result, applyLayer1(input));
        assert.equal(result.cleaned, expected);
        assert.equal(retained.map((index) => input[index]).join(''), expected);
        if (name.startsWith('SGR') || name.startsWith('OSC')) {
            assert.equal(retained[0], input.length - expected.length);
        }
    });
}
//# sourceMappingURL=sanitizer-deletions.test.js.map