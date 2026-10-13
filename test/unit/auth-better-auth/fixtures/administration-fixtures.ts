import assert from 'node:assert/strict';
import { LocalAdministrationError, type AdministrationFailure } from '../../../../src/auth-better-auth/local-user-administration.ts';
import type { PasswordSource } from '../../../../src/auth/local-auth/local-user-administration.ts';
import type { LocalProviderDouble } from './local-provider-double.ts';

export class PasswordAnswers {
  asked = 0;
  private readonly answers: string[];

  constructor(...answers: string[]) {
    this.answers = answers;
  }

  readonly read: PasswordSource = async () => {
    this.asked += 1;
    const answer = this.answers.shift();
    assert.ok(answer !== undefined, 'the administration asked for more passwords than the operator gave');
    return answer;
  };
}

export function rejectsWith(reason: AdministrationFailure) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof LocalAdministrationError, String(error));
    assert.equal(error.reason, reason);
    return true;
  };
}

export function providerSnapshot(provider: LocalProviderDouble) {
  return structuredClone({
    users: [...provider.users.values()],
    credentials: [...provider.credentials],
    sessions: [...provider.sessions],
    clients: provider.clients,
  });
}

export function twoUsersWithSessions(provider: LocalProviderDouble) {
  const alice = provider.addUser('alice@example.com', 'alice-password-1');
  const bob = provider.addUser('bob@example.com', 'bob-password-1');
  for (const user of [alice, bob]) provider.startSession(user.id);
  return { alice, bob };
}
