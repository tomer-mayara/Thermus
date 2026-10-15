export type HostedMfaPolicy = 'optional' | 'required';

export function hostedMfaPolicy(value: string | undefined): HostedMfaPolicy {
  const policy = value ?? 'optional';
  if (policy !== 'optional' && policy !== 'required') throw new Error('WORKOS_MFA_POLICY must be optional or required.');
  return policy;
}

export function assertProviderMfaProfile(policy: HostedMfaPolicy, settings: Readonly<Record<string, unknown>>): void {
  if (settings.mfaEnabled !== true || settings.mfaRequired !== (policy === 'required')) {
    throw new Error(`Hosted live ${policy} profile: provider MFA settings do not match. MFA must be enabled and ${policy === 'required' ? 'required' : 'optional'} before sign-in. No live proof may continue with another provider policy.`);
  }
}
