import { WorkOSAuthProvider } from '../../../src/accounts/providers/workos/workos-auth-provider.ts';
import { WorkOSBrowserSession } from '../../../src/accounts/providers/workos/workos-browser-session.ts';
import type { ProfiledBrowserSessionState } from '../../../src/accounts/identity/browser-session-controls.ts';
import type { VerifiedIdentity } from '../../../src/accounts/identity/identity-verifier.ts';

// No network or timer keeps this identity promise alive. The real CLI must end the HTTP wait during shutdown.
WorkOSAuthProvider.prototype.verifyAccessToken = async (): Promise<VerifiedIdentity> => {
  process.stderr.write('Held hosted token verification\n');
  return new Promise(() => {});
};

WorkOSBrowserSession.prototype.authenticate = async (): Promise<ProfiledBrowserSessionState> => {
  process.stderr.write('Held hosted browser authentication\n');
  return new Promise(() => {});
};
