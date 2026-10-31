type ChangeOperation = 'sendInvitation' | 'resendInvitation' | 'revokeInvitation';

type Override = { readonly result: 'unsupported' | 'stale' | 'not-pending' | 'address-in-use' } | { readonly error: Error; readonly afterChange?: boolean };

export class ChangeAnswers {
  private readonly overrides = new Map<ChangeOperation, Override[]>();
  private held?: Promise<void>;

  queue(operation: ChangeOperation, ...overrides: readonly Override[]): void {
    this.overrides.set(operation, [...(this.overrides.get(operation) ?? []), ...overrides]);
  }

  holdChanges(): () => void {
    const release = Promise.withResolvers<void>();
    this.held = release.promise;
    return () => {
      this.held = undefined;
      release.resolve();
    };
  }

  protected async answer<T>(operation: ChangeOperation, change: () => T): Promise<T> {
    await this.held;
    const override = this.overrides.get(operation)?.shift();
    if (override === undefined) return change();
    if ('result' in override) return { outcome: override.result } as T;
    if (override.afterChange === true) change();
    throw override.error;
  }
}
