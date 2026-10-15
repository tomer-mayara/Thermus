import { trustedAdRulesFile } from './ad-rules.ts';
import { hostedPortalPreload, hostedRendererFixture } from '../processes/module-paths.ts';

// WorkOS settings with placeholder values for the public base URL https://thermus.example. They are valid for the
// settings check but reach no WorkOS environment.
export const workOSSettings: Readonly<Record<string, string>> = {
  WORKOS_AUTHKIT_ISSUER: 'https://thermus-test.authkit.app',
  WORKOS_CLIENT_ID: 'client_placeholder',
  WORKOS_API_KEY: 'sk_test_placeholder',
  WORKOS_REDIRECT_URI: 'https://thermus.example/auth/callback',
  WORKOS_COOKIE_PASSWORD: 'cookie-password-placeholder-0032',
};

// The same placeholder settings for another public base URL: the redirect URI must be inside its path.
export function workOSSettingsFor(publicBaseUrl: string): Readonly<Record<string, string>> {
  const base = publicBaseUrl.endsWith('/') ? publicBaseUrl : `${publicBaseUrl}/`;
  return { ...workOSSettings, WORKOS_REDIRECT_URI: new URL('callback', base).href };
}

export const hostedStartupLine = 'Hosted authentication uses WorkOS: the client client_placeholder and the AuthKit issuer https://thermus-test.authkit.app.';

// Offline startup uses a valid portal and a renderer double that can report only its pinned version.
export const hostedFetchSettings: Readonly<Record<string, string>> = {
  AD_RULES_FILE: trustedAdRulesFile, LIGHTPANDA_BIN: hostedRendererFixture, NODE_OPTIONS: `--import=${hostedPortalPreload}`,
};
