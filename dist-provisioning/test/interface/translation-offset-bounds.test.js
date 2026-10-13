import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isHiddenElement } from 'agent-input-sanitizer/html';
const offsets = ['1208925819614629174706176', '-100000000', '-1208925819614629174706176', '100000000'];
const matrix = (offset) => `matrix(1,0,0,1,${offset},0)`;
for (const { name, transform, hidden } of [
    { name: 'finite cancelling matrix offsets', hidden: false,
        transform: offsets.map(matrix).join(' ') },
    { name: 'finite cancelling translateX offsets', hidden: false,
        transform: offsets.map(offset => `translateX(${offset}px)`).join(' ') },
    { name: 'a genuinely negative matrix offset', hidden: true,
        transform: matrix('-1000000') },
    { name: 'local overflow before cancellation', hidden: false,
        transform: ['-1e308', '-1e308', '1e308', '1e308'].map(matrix).join(' ') },
    { name: 'ordinary exact offset cancellation', hidden: false,
        transform: `${matrix('-1000000')} ${matrix('1000000')}` },
]) {
    test(`isHiddenElement ${hidden ? 'hides' : 'keeps'} an element with ${name}`, () => {
        const element = { type: 'element', tagName: 'div', properties: { style: `transform:${transform}` } };
        assert.equal(isHiddenElement(element), hidden);
    });
}
//# sourceMappingURL=translation-offset-bounds.test.js.map