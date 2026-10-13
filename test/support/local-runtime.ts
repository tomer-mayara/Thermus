import assert from 'node:assert/strict';
import { openBetterAuthRuntime, type BetterAuthRuntime } from '../../src/auth-better-auth/better-auth-runtime.ts';
import { loadDeploymentConfig } from '../../src/config/deployment-config.ts';
import { publicBaseUrl } from './better-auth-local.ts';

type AccountWithStatus = { readonly id: string; readonly email: string; readonly banned?: boolean | null };

export interface LocalAccount {
  readonly id: string;
  readonly email: string;
  readonly disabled: boolean;
}

export function selfHostedSettings(directory: string): Readonly<Record<string, string>> {
  return { DEPLOYMENT: 'self-hosted', PUBLIC_BASE_URL: publicBaseUrl, DATA_DIR: directory, LISTEN_HOST: '127.0.0.1', LISTEN_PORT: '0' };
}

export function selfHostedConfig(directory: string) {
  const config = loadDeploymentConfig(selfHostedSettings(directory), 'http');
  assert.ok(config.deployment === 'self-hosted');
  return config;
}

export async function withRuntime<T>(directory: string, work: (runtime: BetterAuthRuntime) => Promise<T>): Promise<T> {
  const runtime = await openBetterAuthRuntime(selfHostedConfig(directory));
  try {
    return await work(runtime);
  } finally {
    await runtime.close();
  }
}

export function passwordOf(email: string): string {
  return `${email}-password`;
}

export async function addAccount(runtime: BetterAuthRuntime, email: string, disabled = false): Promise<string> {
  const { user } = await runtime.auth.api.createUser({ body: { email, password: passwordOf(email), name: email } });
  if (disabled) await (await runtime.auth.$context).internalAdapter.updateUser(user.id, { banned: true });
  return user.id;
}

export async function accountsOf(runtime: BetterAuthRuntime): Promise<LocalAccount[]> {
  const users = await (await runtime.auth.$context).internalAdapter.listUsers() as AccountWithStatus[];
  return users
    .map(({ id, email, banned }) => ({ id, email, disabled: banned === true }))
    .sort((first, second) => first.email.localeCompare(second.email));
}
