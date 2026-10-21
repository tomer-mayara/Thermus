export function loadSelfServeSignupEnabled(environment: Readonly<Record<string, string | undefined>>): boolean {
  const value = environment.SELF_SERVE_SIGNUP_ENABLED;
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error('SELF_SERVE_SIGNUP_ENABLED must be exactly true or false.');
}
