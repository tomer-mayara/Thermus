import { WorkOSAuthProvider } from '../../../src/auth/hosted-auth/workos/workos-auth-provider.ts';
import { WorkOSBrowserSession, type WorkOSSessionState } from '../../../src/auth/hosted-auth/workos/workos-browser-session.ts';
import type { VerifiedIdentity } from '../../../src/auth/identity-verifier.ts';

// No network or timer keeps this identity promise alive. The real CLI must end the HTTP wait during shutdown.
WorkOSAuthProvider.prototype.verifyAccessToken = async (): Promise<VerifiedIdentity> => {
  process.stderr.write('Held hosted token verification\n');
  return new Promise(() => {});
};

WorkOSBrowserSession.prototype.authenticate = async (): Promise<WorkOSSessionState> => {
  process.stderr.write('Held hosted browser authentication\n');
  return new Promise(() => {});
};
