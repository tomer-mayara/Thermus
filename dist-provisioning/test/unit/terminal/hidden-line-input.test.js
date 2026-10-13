import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { HiddenLineInput } from '../../../src/terminal/hidden-line-input.js';
class FakeTerminal extends PassThrough {
    isTTY = true;
    rawModes = [];
    setRawMode(mode) {
        this.rawModes.push(mode);
        return this;
    }
}
// A read that never settles must fail its test: the test runner does not stop a pending test.
const readTimeout = { timeout: 5_000 };
const inputKinds = [
    { kind: 'piped', create: () => new PassThrough() },
    { kind: 'terminal', create: () => new FakeTerminal() },
];
const terminalCancels = [
    { action: 'Ctrl-C is pressed on an empty line', keys: '\u0003' },
    { action: 'Ctrl-C is pressed after typed text', keys: 'typed\u0003' },
    { action: 'Ctrl-D is pressed on an empty line', keys: '\u0004' },
];
function promptsStream() {
    const chunks = [];
    const prompts = new Writable({
        write(chunk, _encoding, done) {
            chunks.push(String(chunk));
            done();
        },
    });
    return { prompts, written: () => chunks.join('') };
}
function processWrites(t) {
    const spies = [t.mock.method(process.stdout, 'write'), t.mock.method(process.stderr, 'write')];
    return () => spies.flatMap((spy) => spy.mock.calls.map((call) => String(call.arguments[0]))).join('');
}
test('Given piped input with two lines in one chunk, when lines are read, then each read gives the next line and a read after the end gives undefined', readTimeout, async () => {
    const input = new PassThrough();
    const hiddenInput = new HiddenLineInput(input, promptsStream().prompts);
    input.write('first\nsecond\n');
    assert.equal(await hiddenInput.readHiddenLine('Password: '), 'first');
    assert.equal(await hiddenInput.readHiddenLine('Repeat password: '), 'second');
    input.end();
    assert.equal(await hiddenInput.readHiddenLine('Password: '), undefined);
});
test('Given piped lines with CRLF endings, when they are read, then the reads give the lines without the endings', readTimeout, async () => {
    const input = new PassThrough();
    const hiddenInput = new HiddenLineInput(input, promptsStream().prompts);
    input.end('first\r\nsecond\r\n');
    assert.equal(await hiddenInput.readHiddenLine('Password: '), 'first');
    assert.equal(await hiddenInput.readHiddenLine('Repeat password: '), 'second');
});
test('Given piped text without a line ending, when the input ends, then the read gives the text as the last line', readTimeout, async () => {
    const input = new PassThrough();
    const hiddenInput = new HiddenLineInput(input, promptsStream().prompts);
    input.end('last');
    assert.equal(await hiddenInput.readHiddenLine('Password: '), 'last');
    assert.equal(await hiddenInput.readHiddenLine('Password: '), undefined);
});
test('Given piped input, when two lines are read, then the prompts stream gets each prompt and a line break but no line text', readTimeout, async () => {
    const input = new PassThrough();
    const { prompts, written } = promptsStream();
    const hiddenInput = new HiddenLineInput(input, prompts);
    input.end('piped-secret\nother-secret\n');
    await hiddenInput.readHiddenLine('Password: ');
    await hiddenInput.readHiddenLine('Repeat password: ');
    assert.equal(written(), 'Password: \nRepeat password: \n');
});
for (const { kind, create } of inputKinds) {
    test(`Given ${kind} input that ends without a line, when two lines are read, then each read gives undefined after its prompt and a line break`, readTimeout, async () => {
        const input = create();
        const { prompts, written } = promptsStream();
        const hiddenInput = new HiddenLineInput(input, prompts);
        input.end();
        assert.equal(await hiddenInput.readHiddenLine('Password: '), undefined);
        assert.equal(await hiddenInput.readHiddenLine('Repeat password: '), undefined);
        assert.equal(written(), 'Password: \nRepeat password: \n');
    });
}
test('Given a terminal, when a password is typed, then the read gives it, raw mode is on only during the read, and no stream gets the text', readTimeout, async (t) => {
    const input = new FakeTerminal();
    const { prompts, written } = promptsStream();
    const hiddenInput = new HiddenLineInput(input, prompts);
    const writtenByProcess = processWrites(t);
    const read = hiddenInput.readHiddenLine('Password: ');
    assert.deepEqual(input.rawModes, [true]);
    input.write('secret-pass\r');
    assert.equal(await read, 'secret-pass');
    assert.deepEqual(input.rawModes, [true, false]);
    assert.equal(written(), 'Password: \n');
    assert.doesNotMatch(writtenByProcess(), /secret-pass/);
});
test('Given a terminal, when two lines are read one after the other, then each read gives its line and raw mode is off between the reads', readTimeout, async () => {
    const input = new FakeTerminal();
    const hiddenInput = new HiddenLineInput(input, promptsStream().prompts);
    const first = hiddenInput.readHiddenLine('Password: ');
    input.write('first-pass\r');
    assert.equal(await first, 'first-pass');
    assert.deepEqual(input.rawModes, [true, false]);
    const second = hiddenInput.readHiddenLine('Repeat password: ');
    input.write('second-pass\r');
    assert.equal(await second, 'second-pass');
    assert.deepEqual(input.rawModes, [true, false, true, false]);
});
for (const { action, keys } of terminalCancels) {
    test(`Given a terminal, when ${action}, then the read gives undefined and raw mode is off`, readTimeout, async () => {
        const input = new FakeTerminal();
        const { prompts, written } = promptsStream();
        const hiddenInput = new HiddenLineInput(input, prompts);
        const read = hiddenInput.readHiddenLine('Password: ');
        input.write(keys);
        assert.equal(await read, undefined);
        assert.deepEqual(input.rawModes, [true, false]);
        assert.equal(written(), 'Password: \n');
    });
}
test('Given a terminal that fails during a read, when the read waits, then it rejects with the input error and raw mode is off', readTimeout, async () => {
    const input = new FakeTerminal();
    const hiddenInput = new HiddenLineInput(input, promptsStream().prompts);
    const read = hiddenInput.readHiddenLine('Password: ');
    input.destroy(new Error('terminal failed'));
    await assert.rejects(read, { message: 'terminal failed' });
    assert.deepEqual(input.rawModes, [true, false]);
});
test('Given piped input that fails during a read, when the read waits, then it rejects with the input error after the prompt and a line break', readTimeout, async () => {
    const input = new PassThrough();
    const { prompts, written } = promptsStream();
    const hiddenInput = new HiddenLineInput(input, prompts);
    const read = hiddenInput.readHiddenLine('Password: ');
    input.destroy(new Error('pipe failed'));
    await assert.rejects(read, { message: 'pipe failed' });
    assert.equal(written(), 'Password: \n');
});
for (const { kind, create } of inputKinds) {
    test(`Given ${kind} input and no read, when the reader is closed two times, then the input has no data listener and does not flow`, () => {
        const input = create();
        const hiddenInput = new HiddenLineInput(input, promptsStream().prompts);
        assert.equal(input.listenerCount('data'), 0);
        hiddenInput.close();
        hiddenInput.close();
        assert.equal(input.listenerCount('data'), 0);
        assert.equal(input.readableFlowing, null);
    });
}
test('Given piped input that stays open, when the reader is closed after a read, then the input has no data listener and the next read gives undefined', readTimeout, async () => {
    const input = new PassThrough();
    const hiddenInput = new HiddenLineInput(input, promptsStream().prompts);
    input.write('first\n');
    assert.equal(await hiddenInput.readHiddenLine('Password: '), 'first');
    hiddenInput.close();
    assert.equal(input.listenerCount('data'), 0);
    assert.equal(await hiddenInput.readHiddenLine('Password: '), undefined);
});
//# sourceMappingURL=hidden-line-input.test.js.map