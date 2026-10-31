import { auditActorName } from './audit-content.ts';
import type { AuditContext } from './audit-log.ts';
import { DestinationCredentialCodec } from './destination-credential-codec.ts';
import { validDestinationEndpoint } from './destination-endpoint.ts';
import type { DestinationSettingsStore, ReadSettingsResult, SaveSettingsResult, StoredDestinationSettings } from './destination-settings-store.ts';
import type { AuditDestination, AuditSendOutcome } from './audit-send.ts';
import { confirmedTest, DestinationTestLifetime, testEvent } from './destination-test.ts';
import type { DestinationTestResult, DestinationTestSender, TestRequester } from './destination-test.ts';

export type { DestinationTestResult } from './destination-test.ts';

export interface PublicDestinationSettings {
  readonly revision: string | null;
  readonly endpoint: string;
  readonly axiomDataset?: string;
  readonly auth: 'none' | 'bearer';
  readonly enabled: boolean;
  readonly tokenPresent: boolean;
  readonly tokenPreview?: string;
}
export interface DestinationSettingsSaveInput {
  readonly expectedRevision: string | null;
  readonly endpoint: string;
  readonly axiomDataset?: string;
  readonly auth: 'none' | 'bearer';
  readonly enabled: boolean;
  readonly token: string;
}
export type DestinationSettingsReadResult =
  | { readonly status: 'found' | 'absent'; readonly settings: PublicDestinationSettings }
  | { readonly status: 'unavailable' };
export type DestinationSettingsSaveResult =
  | { readonly status: 'saved' | 'unchanged'; readonly settings: PublicDestinationSettings }
  | { readonly status: 'invalid'; readonly reason: 'endpoint' | 'dataset' | 'token' | 'settings' }
  | { readonly status: 'conflict' | 'unavailable' | 'unconfirmed' };

export type ExportAuthorization =
  | { readonly status: 'ready'; readonly destination: AuditDestination }
  | { readonly status: 'changed' | 'unavailable' };

interface SavePlan { readonly token: string; readonly ciphertext?: string }

export class DestinationSettingsService {
  private readonly codec: DestinationCredentialCodec;
  private readonly tests = new DestinationTestLifetime();
  constructor(private readonly store: DestinationSettingsStore, key: Uint8Array, private readonly sender: DestinationTestSender) {
    this.codec = new DestinationCredentialCodec(key);
  }

  /** One current saved version authorizes one export attempt. No cached version can authorize it. */
  async authorizeExport(tenantId: string, expectedRevision: string, signal?: AbortSignal): Promise<ExportAuthorization> {
    try {
      if (signal?.aborted) return { status: 'unavailable' };
      const current = await this.readStored(tenantId);
      const settings = signal?.aborted ? 'unavailable' : exportableSettings(current, expectedRevision);
      if (typeof settings === 'string') return { status: settings };
      const token = this.token(tenantId, settings);
      if (token === null) return { status: 'unavailable' };
      return { status: 'ready', destination: { endpoint: settings.endpoint, ...axiomDatasetOf(settings), auth: settings.auth === 'bearer' ? { type: 'bearer', token } : { type: 'none' } } };
    } catch { return { status: 'unavailable' }; }
  }

  /** Tenant and actor come from the caller's current trusted Admin context. */
  test(tenantId: string, input: DestinationSettingsSaveInput, actor: AuditContext['actor'], signal?: AbortSignal): Promise<DestinationTestResult> {
    const desired = { ...input };
    const name = auditActorName(actor.name);
    const trustedActor = Object.freeze({ authority: actor.authority, subject: actor.subject, ...(name === undefined ? {} : { name }) });
    const requester: TestRequester = { organizationId: tenantId, actor: trustedActor };
    return this.tests.run(control => this.testSaved(requester, desired, control), signal);
  }

  private async testSaved(requester: TestRequester, desired: DestinationSettingsSaveInput, signal: AbortSignal): Promise<DestinationTestResult> {
    const tenantId = requester.organizationId;
    const current = await this.readStored(tenantId);
    if (signal.aborted) return { status: 'cancelled' };
    if (current.status === 'unavailable') return { status: 'unavailable' };
    if (current.status !== 'found') return { status: 'conflict' };
    const settings = { ...current.settings };
    const token = this.token(tenantId, settings);
    if (token === null) return { status: 'unavailable' };
    const mismatch = testMismatch(desired, settings);
    if (mismatch !== undefined) return mismatch;
    let outcome: AuditSendOutcome;
    try {
      outcome = await this.sender.send({ endpoint: settings.endpoint, ...axiomDatasetOf(settings), auth: settings.auth === 'bearer' ? { type: 'bearer', token } : { type: 'none' } }, testEvent(requester, settings.revision), signal);
    } catch { outcome = { kind: 'unconfirmed', reason: 'transport' }; }
    if (signal.aborted) return { status: 'cancelled' };
    const after = await this.readStored(tenantId);
    if (signal.aborted) return { status: 'cancelled' };
    return confirmedTest(after, settings.revision, outcome);
  }

  async read(tenantId: string): Promise<DestinationSettingsReadResult> {
    const result = await this.readStored(tenantId);
    if (result.status !== 'found') {
      if (result.status === 'unavailable') return { status: 'unavailable' };
      return { status: 'absent', settings: { revision: null, endpoint: '', auth: 'none', enabled: false, tokenPresent: false } };
    }
    const token = this.token(tenantId, result.settings);
    if (token === null) return { status: 'unavailable' };
    return { status: 'found', settings: project(result.settings, token) };
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
    const plan = savePlan(desired, settings, previousToken);
    if (!('token' in plan)) return plan;
    const encryptedCredential = desired.auth === 'none' ? null : plan.ciphertext ?? this.codec.encrypt(tenantId, plan.token);
    const result = await this.store.save(tenantId, desired.expectedRevision, { endpoint: desired.endpoint, ...axiomDatasetOf(desired), auth: desired.auth, enabled: desired.enabled, encryptedCredential }).catch(() => ({ status: 'unconfirmed' as const }));
    return publicSaveResult(result, plan.token);
  }

  private async readStored(tenantId: string) {
    try { return await this.store.read(tenantId); }
    catch { return { status: 'unavailable' as const }; }
  }

  private token(tenant: string, settings: StoredDestinationSettings): string | null {
    if (!validStoredSettings(settings)) return null;
    if (settings.auth === 'none') return settings.encryptedCredential === null ? '' : null;
    if (typeof settings.encryptedCredential !== 'string') return null;
    const token = this.codec.decrypt(tenant, settings.encryptedCredential);
    return token !== null && token !== '' && validToken(token) ? token : null;
  }
}

function exportableSettings(current: ReadSettingsResult, expectedRevision: string): StoredDestinationSettings | 'changed' | 'unavailable' {
  if (current.status === 'unavailable') return 'unavailable';
  if (current.status !== 'found') return 'changed';
  const settings = { ...current.settings };
  return settings.enabled === true && settings.revision === expectedRevision ? settings : 'changed';
}

function testMismatch(desired: DestinationSettingsSaveInput, saved: StoredDestinationSettings): DestinationTestResult | undefined {
  if (saved.revision !== desired.expectedRevision) return { status: 'conflict' };
  return matchesSavedSettings(desired, saved) ? undefined : { status: 'unsaved' };
}

function matchesSavedSettings(input: DestinationSettingsSaveInput, saved: StoredDestinationSettings): boolean {
  return input.token === '' && input.endpoint === saved.endpoint && (input.axiomDataset ?? '') === (saved.axiomDataset ?? '') && input.auth === saved.auth && input.enabled === saved.enabled;
}

function invalidInput(input: DestinationSettingsSaveInput): 'endpoint' | 'dataset' | 'token' | 'settings' | undefined {
  if (!validSettingsFields(input)) return 'settings';
  if (typeof input.endpoint !== 'string' || !validDestinationEndpoint(input.endpoint)) return 'endpoint';
  if (!validDataset(input.axiomDataset)) return 'dataset';
  if (!validToken(input.token)) return 'token';
  return undefined;
}

function validSettingsFields(input: DestinationSettingsSaveInput): boolean {
  return ['none', 'bearer'].includes(input.auth) && typeof input.enabled === 'boolean' && (input.expectedRevision === null || typeof input.expectedRevision === 'string');
}

function validDataset(dataset: unknown): boolean {
  return dataset === undefined || (typeof dataset === 'string' && (dataset === '' || /^[A-Za-z0-9-]{1,128}$/.test(dataset)));
}

function validToken(token: unknown): boolean {
  return typeof token === 'string' && token.length <= 8192 && (token === '' || /^[A-Za-z0-9._~+/-]+=*$/.test(token));
}

function validStoredSettings(settings: StoredDestinationSettings): boolean {
  return invalidInput({ ...settings, expectedRevision: settings.revision, token: '' }) === undefined && typeof settings.revision === 'string' && settings.revision.trim() !== '';
}

function savePlan(desired: DestinationSettingsSaveInput, saved: StoredDestinationSettings | undefined, savedToken: string): SavePlan | { readonly status: 'conflict' } | { readonly status: 'invalid'; readonly reason: 'token' } {
  if ((saved?.revision ?? null) !== desired.expectedRevision) return { status: 'conflict' };
  const token = retainedToken(desired, saved, savedToken);
  if (token === null) return { status: 'invalid', reason: 'token' };
  return { token, ciphertext: token === savedToken && saved?.encryptedCredential ? saved.encryptedCredential : undefined };
}

function retainedToken(input: DestinationSettingsSaveInput, current: StoredDestinationSettings | undefined, previous: string): string | null {
  if (input.auth === 'none') return '';
  if (input.token !== '') return input.token;
  return current?.auth === 'bearer' && current.endpoint === input.endpoint ? previous : null;
}

function publicSaveResult(result: SaveSettingsResult, token: string): DestinationSettingsSaveResult {
  return result.status === 'saved' || result.status === 'unchanged' ? { status: result.status, settings: project(result.settings, token) } : { status: result.status };
}

function axiomDatasetOf(settings: { readonly axiomDataset?: string }): { readonly axiomDataset?: string } {
  return settings.axiomDataset ? { axiomDataset: settings.axiomDataset } : {};
}

function project(settings: StoredDestinationSettings, token: string): PublicDestinationSettings {
  return { revision: settings.revision, endpoint: settings.endpoint, ...axiomDatasetOf(settings), auth: settings.auth, enabled: settings.enabled, tokenPresent: settings.auth === 'bearer', ...(settings.auth === 'bearer' ? { tokenPreview: `${token.length > 4 ? token.slice(0, 4) : ''}****` } : {}) };
}
