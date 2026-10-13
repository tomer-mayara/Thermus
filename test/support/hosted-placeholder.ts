export const workOSSettings: Readonly<Record<string, string>> = {
  WORKOS_AUTHKIT_ISSUER: 'https://magumagu-test.authkit.app',
  WORKOS_CLIENT_ID: 'client_placeholder',
  WORKOS_API_KEY: 'workos-api-key-placeholder',
  WORKOS_REDIRECT_URI: 'https://magumagu.example/auth/callback',
  WORKOS_COOKIE_PASSWORD: 'cookie-password-placeholder-0032',
};

export const mcpUnavailableAnswer = { error: 'temporarily_unavailable', error_description: 'Hosted authentication is not available yet.' };

export const unavailableNotice = /Hosted authentication is not available yet\./;

export const hostedStartupLine = 'Hosted authentication is not available yet. Each hosted request gets the authentication-unavailable notice.';
