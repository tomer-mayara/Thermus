import { readApiKey, UsageError } from '../render-tenant-lifecycle/inputs.ts';
import type { HostedLiveSettings } from '../../../test/support/hosted-live/settings.ts';

type Environment = Readonly<Record<string, string | undefined>>;

// The WorkOS Staging environment of the hosted live gate. The probe refuses each other environment, so that a
// Production key cannot reach a probe service or the fixtures.
export const STAGING_CLIENT_ID = 'client_01M4VDKB7C7T2GV2NWPS84HADP';
export const STAGING_ISSUER = 'https://reasonable-field-33-staging.authkit.app';
const SPACE_OR_CONTROL = /[\s\p{Cc}]/u;

export interface ProbeSecrets {
  readonly renderKey: string;
  readonly workos: HostedLiveSettings;
}

// Each message names the variable and its rule, never its value.
export function readSecrets(environment: Environment): ProbeSecrets {
  const renderKey = readApiKey(environment);
  const apiKey = environment.WORKOS_API_KEY ?? '';
  if (apiKey.trim() === '') throw new UsageError('WORKOS_API_KEY is not set. Real mode needs the WorkOS Staging values; run the probe through with-workos-staging.cjs.');
  if (!apiKey.startsWith('sk_test_') || SPACE_OR_CONTROL.test(apiKey)) throw new UsageError('WORKOS_API_KEY must be a WorkOS test key that starts with sk_test_, without spaces or control characters.');
  if (environment.WORKOS_CLIENT_ID !== STAGING_CLIENT_ID) throw new UsageError(`WORKOS_CLIENT_ID must be the client of the WorkOS Staging environment, ${STAGING_CLIENT_ID}.`);
  if (environment.WORKOS_AUTHKIT_ISSUER !== STAGING_ISSUER) throw new UsageError(`WORKOS_AUTHKIT_ISSUER must be the AuthKit issuer of the WorkOS Staging environment, ${STAGING_ISSUER}.`);
  return Object.freeze({ renderKey, workos: Object.freeze({ apiKey, clientId: STAGING_CLIENT_ID, authkitIssuer: STAGING_ISSUER }) });
}
