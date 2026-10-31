import type { DestinationSettingsSaveInput } from '../../../logs/audit/destination-settings-service.ts';
import { formFields, single, type FormRefusal } from './account-form.ts';

export interface LoggingForm extends DestinationSettingsSaveInput { readonly tenantId: string }

const FIELD_VALUE = /^[\x21-\x7e]{1,256}$/;
const AXIOM_DATASET = /^[A-Za-z0-9-]{1,128}$/;

export function loggingForm(form: URLSearchParams, csrfToken: string): LoggingForm | FormRefusal {
  const required = new URLSearchParams(form);
  required.delete('enabled');
  required.delete('axiom_dataset');
  const fields = formFields(required, csrfToken, ['organization_id', 'expected_revision', 'endpoint', 'destination', 'auth', 'token']);
  if (typeof fields === 'string') return fields;
  const enabled = enabledIn(form.getAll('enabled'));
  const destination = destinationIn(fields.destination, form.getAll('axiom_dataset'));
  // The legacy form field names the trusted tenant, not a provider organization selector.
  const tenantId = fields.organization_id;
  const revision = revisionIn(fields.expected_revision);
  const auth = fields.auth;
  if (enabled === undefined || destination === undefined || !FIELD_VALUE.test(tenantId) || revision === undefined || auth !== 'bearer') return 'invalidRequest';
  return { tenantId, expectedRevision: revision, endpoint: fields.endpoint, ...destination, auth, token: fields.token, enabled };
}

function enabledIn(values: readonly string[]): boolean | undefined {
  if (values.length === 0) return false;
  return single(values) === 'on' ? true : undefined;
}

function destinationIn(destination: string, datasets: readonly string[]): { readonly axiomDataset?: string } | undefined {
  if (datasets.length > 1) return undefined;
  const dataset = datasets[0] ?? '';
  if (destination === 'axiom') return AXIOM_DATASET.test(dataset) ? { axiomDataset: dataset } : undefined;
  if (destination === 'custom') return dataset === '' ? {} : undefined;
  return undefined;
}

function revisionIn(value: string): string | null | undefined {
  if (value === '') return null;
  return FIELD_VALUE.test(value) ? value : undefined;
}
