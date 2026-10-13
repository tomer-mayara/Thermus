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
import { pathToFileURL } from 'node:url';
import { createApplication } from './application.js';
import { loadDeploymentConfig, loadListenAddress } from './config/deployment-config.js';
import { startHttpServer } from './http/server.js';
import { ConsoleLogger } from './logging/console-logger.js';
import { HiddenLineInput } from './terminal/hidden-line-input.js';
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
    process.exitCode = await run(process.argv.slice(2), process.env, new ConsoleLogger());
}
async function run(args, environment, logger) {
    if (args.length > 0)
        return runOperatorCommand(args, environment, logger);
    try {
        await serve(environment, logger);
        return 0;
    }
    catch (error) {
        logger.fatal(failureMessage(error));
        return 1;
    }
}
// Only an operator command loads the local commands, so the server start loads no local module before its edition branch.
async function runOperatorCommand(args, environment, logger) {
    const { runLocalAuthCommand } = await import('./auth-better-auth/local-auth-command.js');
    const input = new HiddenLineInput(process.stdin, process.stderr);
    try {
        return await runLocalAuthCommand(args, { environment, input, output: process.stdout, logger });
    }
    finally {
        input.close();
    }
}
async function serve(environment, logger) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const config = loadDeploymentConfig(environment, 'http');
        const listen = loadListenAddress(environment);
        const owned = __addDisposableResource(env_1, new AsyncDisposableStack(), true);
        const application = owned.adopt(await createApplication(config, logger), (started) => started.close());
        const server = owned.adopt(await startHttpServer(application.handle, { listen, publicBaseUrl: config.publicBaseUrl, logger }), (listening) => listening.close());
        logger.info(`Listening on ${server.url.origin}`);
        const signal = await stopSignal();
        logger.info(`Stopping after ${signal}`);
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
function stopSignal() {
    return new Promise((resolve) => {
        const stop = (signal) => {
            process.off('SIGINT', stop);
            process.off('SIGTERM', stop);
            resolve(signal);
        };
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
    });
}
function failureMessage(error) {
    if (error instanceof SuppressedError) {
        return `${failureMessage(error.suppressed)} The cleanup after this failure also failed: ${failureMessage(error.error)}`;
    }
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=index.js.map