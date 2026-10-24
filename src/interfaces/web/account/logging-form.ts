import type { DestinationSettingsSaveInput } from '../../../logs/audit/destination-settings-service.ts';
import { formFields, type FormRefusal } from './account-form.ts';

export interface LoggingForm extends DestinationSettingsSaveInput { readonly tenantId: string }

export function loggingForm(form: URLSearchParams, csrfToken: string): LoggingForm | FormRefusal {
  const required = new URLSearchParams(form);
  required.delete('enabled');
  const fields = formFields(required, csrfToken, ['organization_id', 'expected_revision', 'endpoint', 'auth', 'token']);
  if (typeof fields === 'string') return fields;
  const enabled = form.getAll('enabled');
  if (enabled.length > 1 || (enabled.length === 1 && enabled[0] !== 'on')) return 'invalidRequest';
  // The legacy form field names the trusted tenant, not a provider organization selector.
  const tenantId = fields.organization_id;
  const revision = fields.expected_revision;
  const auth = fields.auth;
  if (!/^[\x21-\x7e]{1,256}$/.test(tenantId) || (revision !== '' && !/^[\x21-\x7e]{1,256}$/.test(revision)) || (auth !== 'none' && auth !== 'bearer')) return 'invalidRequest';
  return { tenantId, expectedRevision: revision === '' ? null : revision, endpoint: fields.endpoint, auth, token: fields.token, enabled: enabled.length === 1 };
}
