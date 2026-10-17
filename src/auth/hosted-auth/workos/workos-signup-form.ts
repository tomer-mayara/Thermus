import { sameSecret } from './session-cookies.ts';

export function signupAgreementIn(form: URLSearchParams, csrfToken: string, version: string): 'accepted' | 'forgedRequest' | 'invalidRequest' {
  const single = (name: string): string | undefined => {
    const values = form.getAll(name);
    return values.length === 1 ? values[0] : undefined;
  };
  const csrf = single('csrf_token');
  if (csrf === undefined || csrfToken === '' || !sameSecret(csrf, csrfToken)) return 'forgedRequest';
  const fields = new Set(['csrf_token', 'document_version', 'agreement']);
  if ([...form.keys()].some((name) => !fields.has(name))) return 'invalidRequest';
  return single('document_version') === version && single('agreement') === 'accepted' ? 'accepted' : 'invalidRequest';
}
