import { parseArgs } from 'node:util';
// A usage message never repeats the arguments, because an argument can be a mistyped password.
export class UsageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UsageError';
    }
}
export const USAGE = [
    'Usage:',
    '  magumagu                                Start the server.',
    '  magumagu users add <email>              Add an enabled account. Asks for its password two times.',
    '  magumagu users list                     List the accounts and their state.',
    '  magumagu users reset-password <email>   Set a new password and end the sessions of the account.',
    '  magumagu users disable <email>          Disable the account and end its sessions.',
    '  magumagu clients register --user <email> --name <name> --redirect-uri <uri> [--redirect-uri <uri> ...]',
    '                                          Register a native MCP client. Asks for the password of the account.',
    'Stop the server before you run a command. A command reads passwords from a hidden prompt or from standard input, never from its arguments.',
].join('\n');
const REGISTRATION_OPTIONS = {
    user: { type: 'string', multiple: true },
    name: { type: 'string', multiple: true },
    'redirect-uri': { type: 'string', multiple: true },
};
export function parseLocalAuthCommand(args) {
    const [group, verb, ...rest] = args;
    const action = `${group} ${verb}`;
    switch (action) {
        case 'users add':
        case 'users reset-password':
        case 'users disable':
            return { action, email: onlyEmailTarget(action, rest) };
        case 'users list':
            if (rest.length > 0)
                throw new UsageError('users list takes no arguments.');
            return { action };
        case 'clients register':
            return { action, ...registration(rest) };
        default:
            throw new UsageError('Unknown command.');
    }
}
function onlyEmailTarget(action, rest) {
    const [email, ...others] = rest;
    if (email === undefined || email.startsWith('-') || others.length > 0) {
        throw new UsageError(`${action} needs one email address and no other argument.`);
    }
    return email;
}
function registration(rest) {
    const { user = [], name = [], 'redirect-uri': redirectUris = [] } = registrationOptions(rest);
    const [email] = user;
    const [clientName] = name;
    if (email === undefined || clientName === undefined || user.length > 1 || name.length > 1 || redirectUris.length === 0) {
        throw new UsageError('clients register needs one --user, one --name, and at least one --redirect-uri.');
    }
    return { email, client: { name: clientName, redirectUris } };
}
function registrationOptions(rest) {
    try {
        return parseArgs({ args: [...rest], options: REGISTRATION_OPTIONS, strict: true, allowPositionals: false }).values;
    }
    catch (error) {
        if (!String(error?.code).startsWith('ERR_PARSE_ARGS'))
            throw error;
        throw new UsageError('clients register takes only --user, --name, and --redirect-uri, each with a value.');
    }
}
//# sourceMappingURL=local-auth-command-line.js.map