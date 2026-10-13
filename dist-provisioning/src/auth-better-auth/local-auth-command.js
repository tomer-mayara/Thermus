var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import { loadDeploymentConfig } from '../config/deployment-config.js';
import { openBetterAuthRuntime } from './better-auth-runtime.js';
import { parseLocalAuthCommand, USAGE, UsageError } from './local-auth-command-line.js';
import { LocalUserAdministration } from './local-user-administration.js';
class LocalCommandUnavailableError extends Error {
    constructor() {
        super('The user and client commands are only for DEPLOYMENT=self-hosted.');
        this.name = 'LocalCommandUnavailableError';
    }
}
class PasswordEntryError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PasswordEntryError';
    }
}
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;
const ADD_PROMPTS = ['Password for the new account: ', 'Repeat the password: '];
const RESET_PROMPTS = ['New password: ', 'Repeat the new password: '];
const ACCOUNT_PASSWORD_PROMPT = 'Password of the account: ';
export async function runLocalAuthCommand(args, context) {
    const command = parsedCommand(args, context.logger);
    if (command === undefined)
        return EXIT_USAGE;
    try {
        await runWithRuntime(command, context);
        return EXIT_SUCCESS;
    }
    catch (error) {
        context.logger.error(failureMessage(error));
        return EXIT_FAILURE;
    }
}
function parsedCommand(args, logger) {
    try {
        return parseLocalAuthCommand(args);
    }
    catch (error) {
        if (!(error instanceof UsageError))
            throw error;
        logger.error(`${error.message}\n${USAGE}`);
        return undefined;
    }
}
async function runWithRuntime(command, context) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const config = loadDeploymentConfig(context.environment, 'http');
        if (config.deployment !== 'self-hosted')
            throw new LocalCommandUnavailableError();
        const openRuntime = context.openRuntime ?? openBetterAuthRuntime;
        const owned = __addDisposableResource(env_1, new AsyncDisposableStack(), true);
        const runtime = owned.adopt(await openRuntime(config), (opened) => opened.close());
        const administration = new LocalUserAdministration(runtime.auth, runtime.resourceServerClient);
        context.output.write(await perform(command, administration, context.input));
    }
    catch (e_1) {
        env_1.error = e_1;
        env_1.hasError = true;
    }
    finally {
        const result_1 = __disposeResources(env_1);
        if (result_1)
            await result_1;
    }
}
async function perform(command, administration, input) {
    switch (command.action) {
        case 'users add':
            return addedMessage(await administration.addUser(command.email, newPassword(input, ADD_PROMPTS)));
        case 'users list':
            return accountTable(await administration.listUsers());
        case 'users reset-password':
            return resetMessage(await administration.resetPassword(command.email, newPassword(input, RESET_PROMPTS)));
        case 'users disable':
            return `Disabled ${(await administration.disableUser(command.email)).email} and ended its sessions.\n`;
        case 'clients register':
            return registeredMessage(await administration.registerClient(command.email, () => enteredLine(input, ACCOUNT_PASSWORD_PROMPT), command.client));
    }
}
function newPassword(input, [prompt, repeatPrompt]) {
    return async () => {
        const password = await enteredLine(input, prompt);
        if (await enteredLine(input, repeatPrompt) !== password)
            throw new PasswordEntryError('The passwords do not match.');
        return password;
    };
}
async function enteredLine(input, prompt) {
    const line = await input.readHiddenLine(prompt);
    if (line === undefined)
        throw new PasswordEntryError('No password was entered.');
    return line;
}
function addedMessage(account) {
    return `Added ${account.email} with ID ${account.id}.\n`;
}
function registeredMessage(client) {
    const registered = `Registered the client "${client.name}" with client ID ${client.clientId}.\n`;
    if (!client.resourceServerClientRegistered)
        return registered;
    return `${registered}Registered the resource-server client that the MCP server uses to check access tokens.\n`;
}
function resetMessage(account) {
    const disabled = account.disabled ? ' The account stays disabled.' : '';
    return `Reset the password of ${account.email} and ended its sessions.${disabled}\n`;
}
function accountTable(accounts) {
    if (accounts.length === 0)
        return 'No local accounts. Add one with: magumagu users add <email>\n';
    const rows = [['EMAIL', 'STATE', 'ID'], ...accounts.map(({ email, disabled, id }) => [email, disabled ? 'disabled' : 'enabled', id])];
    const emailWidth = Math.max(...rows.map(([email = '']) => email.length));
    const stateWidth = Math.max(...rows.map(([, state = '']) => state.length));
    return rows.map(([email = '', state = '', id = '']) => `${email.padEnd(emailWidth)}  ${state.padEnd(stateWidth)}  ${id}\n`).join('');
}
function failureMessage(error) {
    if (error instanceof SuppressedError) {
        return `${failureMessage(error.suppressed)} The cleanup after this failure also failed: ${failureMessage(error.error)}`;
    }
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=local-auth-command.js.map