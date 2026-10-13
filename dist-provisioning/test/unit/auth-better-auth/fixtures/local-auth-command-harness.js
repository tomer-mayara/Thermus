import assert from 'node:assert/strict';
import { runLocalAuthCommand } from '../../../../src/auth-better-auth/local-auth-command.js';
import { LocalProviderDouble } from './local-provider-double.js';
export const environment = {
    DEPLOYMENT: 'self-hosted',
    PUBLIC_BASE_URL: 'http://localhost:8080',
    DATA_DIR: '/var/lib/magumagu',
};
export const loopbackRedirectUri = 'http://127.0.0.1:33418/callback';
export const passwords = ['alice-password-1', 'alice-password-2', 'bob-password-1', 'dana-password-1', 'secret-value'];
export class ScriptedInput {
    prompts = [];
    lines;
    constructor(...lines) {
        this.lines = lines;
    }
    async readHiddenLine(prompt) {
        this.prompts.push(prompt);
        return this.lines.shift();
    }
}
export class RuntimeDouble {
    events = [];
    settings = [];
    provider = new LocalProviderDouble();
    openFailure;
    closeFailure;
    open = async (settings) => {
        this.events.push('open');
        this.settings.push(settings);
        if (this.openFailure)
            throw this.openFailure;
        return {
            installationId: 'installation-id',
            tenantId: 'local:installation-id',
            auth: this.provider.auth,
            resourceServerClient: this.provider.resourceServerClient,
            close: async () => {
                this.events.push('close');
                if (this.closeFailure)
                    throw this.closeFailure;
            },
        };
    };
}
export async function run(args, options = {}) {
    const runtime = options.runtime ?? new RuntimeDouble();
    const input = options.input ?? new ScriptedInput();
    let output = '';
    const errors = [];
    const code = await runLocalAuthCommand(args, {
        environment: options.environment ?? environment,
        input,
        output: { write: (text) => { output += text; } },
        logger: { error: (message) => { errors.push(message); } },
        openRuntime: runtime.open,
    });
    return { code, output, errors: errors.join('\n'), prompts: input.prompts };
}
export function assertRevealsNone(result, secrets = passwords) {
    for (const secret of secrets) {
        assert.ok(!result.output.includes(secret), 'a password appeared in the command output');
        assert.ok(!result.errors.includes(secret), 'a password appeared in the command log');
        assert.ok(!result.prompts.some((prompt) => prompt.includes(secret)), 'a password appeared in a prompt');
    }
}
//# sourceMappingURL=local-auth-command-harness.js.map