// A live test precondition. This check neither configures WorkOS nor sets an application policy.
export function assertProviderPasswordProfile(settings: Readonly<Record<string, unknown>>): void {
  if (settings.passwordAuthEnabled !== true || settings.mfaEnabled !== false || settings.mfaRequired !== false) {
    throw new Error('Hosted live password profile requires password authentication enabled and provider MFA disabled. No live proof may continue with another provider configuration.');
  }
}
