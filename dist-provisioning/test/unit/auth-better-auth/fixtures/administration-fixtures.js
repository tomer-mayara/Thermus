import assert from 'node:assert/strict';
import { LocalAdministrationError } from '../../../../src/auth-better-auth/local-user-administration.js';
export class PasswordAnswers {
    asked = 0;
    answers;
    constructor(...answers) {
        this.answers = answers;
    }
    read = async () => {
        this.asked += 1;
        const answer = this.answers.shift();
        assert.ok(answer !== undefined, 'the administration asked for more passwords than the operator gave');
        return answer;
    };
}
export function rejectsWith(reason) {
    return (error) => {
        assert.ok(error instanceof LocalAdministrationError, String(error));
        assert.equal(error.reason, reason);
        return true;
    };
}
export function providerSnapshot(provider) {
    return structuredClone({
        users: [...provider.users.values()],
        credentials: [...provider.credentials],
        sessions: [...provider.sessions],
        clients: provider.clients,
    });
}
export function twoUsersWithSessions(provider) {
    const alice = provider.addUser('alice@example.com', 'alice-password-1');
    const bob = provider.addUser('bob@example.com', 'bob-password-1');
    for (const user of [alice, bob])
        provider.startSession(user.id);
    return { alice, bob };
}
//# sourceMappingURL=administration-fixtures.js.map