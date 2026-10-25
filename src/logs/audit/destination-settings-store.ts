/** The caller obtains the opaque tenant ID from current trusted organization access. */
export interface DestinationSettings {
  readonly endpoint: string;
  readonly axiomDataset?: string;
  readonly auth: 'none' | 'bearer';
  readonly enabled: boolean;
  readonly encryptedCredential: string | null;
}

export interface StoredDestinationSettings extends DestinationSettings {
  readonly revision: string;
}

export type ReadSettingsResult =
  | { readonly status: 'found'; readonly settings: StoredDestinationSettings }
  | { readonly status: 'absent' | 'unavailable' };

export type SaveSettingsResult =
  | { readonly status: 'saved' | 'unchanged'; readonly settings: StoredDestinationSettings }
  | { readonly status: 'conflict' | 'unavailable' | 'unconfirmed' };

export interface DestinationSettingsStore {
  read(tenantId: string): Promise<ReadSettingsResult>;
  /** Null expects absence. Preserve ciphertext when the plaintext credential has not changed. */
  save(tenantId: string, expectedRevision: string | null, desired: DestinationSettings): Promise<SaveSettingsResult>;
}
