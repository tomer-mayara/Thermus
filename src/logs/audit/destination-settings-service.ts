import { DestinationCredentialCodec } from './destination-credential-codec.ts';
import { validDestinationEndpoint } from './destination-endpoint.ts';
import type { DestinationSettingsStore, StoredDestinationSettings } from './destination-settings-store.ts';

export interface PublicDestinationSettings {
  readonly revision: string | null;
  readonly endpoint: string;
  readonly auth: 'none' | 'bearer';
  readonly enabled: boolean;
  readonly tokenPresent: boolean;
}
export interface DestinationSettingsSaveInput {
  readonly expectedRevision: string | null;
  readonly endpoint: string;
  readonly auth: 'none' | 'bearer';
  readonly enabled: boolean;
  readonly token: string;
}
export type DestinationSettingsReadResult =
  | { readonly status: 'found' | 'absent'; readonly settings: PublicDestinationSettings }
  | { readonly status: 'unavailable' };
export type DestinationSettingsSaveResult =
  | { readonly status: 'saved' | 'unchanged'; readonly settings: PublicDestinationSettings }
  | { readonly status: 'invalid'; readonly reason: 'endpoint' | 'token' | 'settings' }
  | { readonly status: 'conflict' | 'unavailable' | 'unconfirmed' };

export class DestinationSettingsService {
  private readonly codec: DestinationCredentialCodec;
  constructor(private readonly store: DestinationSettingsStore, key: Uint8Array) {
    this.codec = new DestinationCredentialCodec(key);
  }

  async read(tenantId: string): Promise<DestinationSettingsReadResult> {
    const result = await this.readStored(tenantId);
    if (result.status !== 'found') {
      if (result.status === 'unavailable') return { status: 'unavailable' };
      return { status: 'absent', settings: { revision: null, endpoint: '', auth: 'none', enabled: false, tokenPresent: false } };
    }
    if (this.token(tenantId, result.settings) === null) return { status: 'unavailable' };
    return { status: 'found', settings: project(result.settings) };
  }

  async save(tenantId: string, input: DestinationSettingsSaveInput): Promise<DestinationSettingsSaveResult> {
    const desired = { ...input };
    const invalid = invalidInput(desired);
    if (invalid) return { status: 'invalid', reason: invalid };
    const current = await this.readStored(tenantId);
    if (current.status === 'unavailable') return { status: 'unavailable' };
    const settings = current.status === 'found' ? current.settings : undefined;
    const previousToken = settings ? this.token(tenantId, settings) : '';
    if (previousToken === null) return { status: 'unavailable' };
    if ((settings?.revision ?? null) !== desired.expectedRevision) return { status: 'conflict' };
    const token = retainedToken(desired, settings, previousToken);
    if (token === null) return { status: 'invalid', reason: 'token' };
    const encryptedCredential = desired.auth === 'none' ? null
      : token === previousToken && settings?.encryptedCredential ? settings.encryptedCredential : this.codec.encrypt(tenantId, token);
    const result = await this.store.save(tenantId, desired.expectedRevision, { endpoint: desired.endpoint, auth: desired.auth, enabled: desired.enabled, encryptedCredential }).catch(() => ({ status: 'unconfirmed' as const }));
    if (result.status === 'saved' || result.status === 'unchanged') return { status: result.status, settings: project(result.settings) };
    return { status: result.status };
  }

  private readStored(tenantId: string) {
    return this.store.read(tenantId).catch(() => ({ status: 'unavailable' as const }));
  }

  private token(tenant: string, settings: StoredDestinationSettings): string | null {
    if (invalidInput({ ...settings, expectedRevision: settings.revision, token: '' })
      || typeof settings.revision !== 'string' || settings.revision.trim() === '') return null;
    if (settings.auth === 'none') return settings.encryptedCredential === null ? '' : null;
    if (typeof settings.encryptedCredential !== 'string') return null;
    const token = this.codec.decrypt(tenant, settings.encryptedCredential);
    return token !== null && token !== '' && !invalidInput({ ...settings, expectedRevision: settings.revision, token }) ? token : null;
  }
}

function invalidInput(input: DestinationSettingsSaveInput): 'endpoint' | 'token' | 'settings' | undefined {
  if (!['none', 'bearer'].includes(input.auth) || typeof input.enabled !== 'boolean'
    || !(input.expectedRevision === null || typeof input.expectedRevision === 'string')) return 'settings';
  if (typeof input.endpoint !== 'string' || !validDestinationEndpoint(input.endpoint)) return 'endpoint';
  if (typeof input.token !== 'string' || input.token.length > 8192 || (input.token !== '' && !/^[A-Za-z0-9._~+/-]+=*$/.test(input.token))) return 'token';
  return undefined;
}

function retainedToken(input: DestinationSettingsSaveInput, current: StoredDestinationSettings | undefined, previous: string): string | null {
  if (input.auth === 'none') return '';
  if (input.token !== '') return input.token;
  return current?.auth === 'bearer' && current.endpoint === input.endpoint ? previous : null;
}

function project(settings: StoredDestinationSettings): PublicDestinationSettings {
  return { revision: settings.revision, endpoint: settings.endpoint, auth: settings.auth, enabled: settings.enabled, tokenPresent: settings.auth === 'bearer' };
}
