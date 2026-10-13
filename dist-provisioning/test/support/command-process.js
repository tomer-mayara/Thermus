import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
const commandEntry = fileURLToPath(new URL('../../src/index.js', import.meta.url));
const networkBlocker = new URL('./deny-network.js', import.meta.url).href;
const sqlTracer = new URL('./trace-sqlite.js', import.meta.url).href;
export class CommandProcess {
    child;
    exit;
    stdoutText = '';
    stderrText = '';
    stderrListeners = new Set();
    constructor(settings, args) {
        const preloads = ['--import', networkBlocker, '--import', sqlTracer];
        this.child = spawn(process.execPath, [...preloads, commandEntry, ...args], { env: { ...settings }, stdio: ['pipe', 'pipe', 'pipe'] });
        // A command that stops before it reads its input closes the pipe; that is not a test failure.
        this.child.stdin.on('error', () => undefined);
        this.child.stdout.setEncoding('utf8').on('data', (chunk) => { this.stdoutText += chunk; });
        this.child.stderr.setEncoding('utf8').on('data', (chunk) => {
            this.stderrText += chunk;
            for (const listener of this.stderrListeners)
                listener();
        });
        this.exit = once(this.child, 'close').then(([code, signal]) => ({
            code,
            signal,
            stdout: this.stdoutText,
            stderr: this.stderrText,
        }));
    }
    static launch(t, settings, args) {
        const command = new CommandProcess(settings, args);
        t.after(() => command.kill());
        return command;
    }
    get stderr() {
        return this.stderrText;
    }
    async stderrMatches(pattern) {
        const matched = new Promise((resolve) => {
            const check = () => {
                if (!pattern.test(this.stderrText))
                    return;
                this.stderrListeners.delete(check);
                resolve(true);
            };
            this.stderrListeners.add(check);
            check();
        });
        return Promise.race([matched, this.exit.then(() => pattern.test(this.stderrText))]);
    }
    answer(lines) {
        for (const line of lines)
            this.child.stdin.write(`${line}\n`);
        this.child.stdin.end();
    }
    async result() {
        return this.exit;
    }
    kill() {
        if (this.child.exitCode === null && this.child.signalCode === null)
            this.child.kill('SIGKILL');
    }
}
export async function runCommand(t, settings, line) {
    const command = CommandProcess.launch(t, settings, line.args);
    command.answer(line.input ?? []);
    return command.result();
}
export function assertExit(result, code) {
    assert.equal(result.code, code, `exit ${result.code}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}
export function assertRevealsNone(results, secrets) {
    for (const { stdout, stderr } of results) {
        for (const secret of secrets) {
            assert.ok(!stdout.includes(secret), 'a password appeared on standard output');
            assert.ok(!stderr.includes(secret), 'a password appeared on standard error');
        }
        assert.doesNotMatch(stderr, /Outbound network access/);
    }
}
//# sourceMappingURL=command-process.js.map