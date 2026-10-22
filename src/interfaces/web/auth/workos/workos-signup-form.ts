import { sameSecret } from '../../../../accounts/providers/workos/session-cookies.ts';
import { organizationNameIn } from '../../../../accounts/organizations/signup-activation.ts';

export function signupRequestIn(form: URLSearchParams, csrfToken: string, version: string): { readonly organizationName: string } | 'forgedRequest' | 'invalidRequest' {
  const single = (name: string): string | undefined => {
    const values = form.getAll(name);
    return values.length === 1 ? values[0] : undefined;
  };
  const csrf = single('csrf_token');
  if (csrf === undefined || csrfToken === '' || !sameSecret(csrf, csrfToken)) return 'forgedRequest';
  const fields = new Set(['csrf_token', 'document_version', 'organization_name', 'agreement']);
  if ([...form.keys()].some((name) => !fields.has(name))) return 'invalidRequest';
  const organizationName = organizationNameIn(single('organization_name'));
  if (organizationName === undefined || single('document_version') !== version || single('agreement') !== 'accepted') return 'invalidRequest';
  return { organizationName };
}
