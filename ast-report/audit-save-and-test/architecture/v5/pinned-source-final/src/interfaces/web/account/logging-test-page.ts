import type { AuditSendOutcome } from '../../../logs/audit/audit-send.ts';
import type { DestinationTestResult } from '../../../logs/audit/destination-settings-service.ts';
import type { LoggingNotice } from './logging-page.ts';
import type { FormRefusal } from './account-form.ts';

type TestNotice = LoggingNotice;

const sendNotices: Readonly<Record<AuditSendOutcome['kind'], TestNotice>> = {
  accepted: { title: 'Test accepted', message: 'Destination accepted the Test event.', status: 200 },
  warning: { title: 'Test warning', message: 'Destination accepted the Test event with a warning.', status: 200 },
  partial_rejection: { title: 'Test rejected', message: 'Destination rejected the Test event.', status: 502 },
  permanent_failure: { title: 'Test failed', message: 'The Test attempt failed. Check the saved destination.', status: 502 },
  transient_failure: { title: 'Test unavailable', message: 'The Test attempt could not complete. Try again later.', status: 503 },
  unconfirmed: { title: 'Test unconfirmed', message: 'The Test result is unconfirmed. The event may have reached the destination.', status: 503 },
  cancelled: { title: 'Test cancelled', message: 'The Test was cancelled. The event may have reached the destination.', status: 409 },
  busy: { title: 'Test busy', message: 'Test is busy. Try again later.', status: 429 },
};

const operationNotices: Readonly<Record<Exclude<DestinationTestResult['status'], 'tested'>, TestNotice>> = {
  conflict: { title: 'Test result suppressed', message: 'The saved destination changed or is absent. Read saved settings before Test. No result is shown.', status: 409 },
  unavailable: { title: 'Test unavailable', message: 'Saved destination settings are unavailable. No Test result is shown.', status: 503 },
  unsaved: { title: 'Test result suppressed', message: 'The saved settings could not be matched. Read saved settings before another Test.', status: 409 },
  busy: sendNotices.busy,
  cancelled: sendNotices.cancelled,
  unconfirmed: { title: 'Test result suppressed', message: 'The current saved destination could not be confirmed. Read saved settings before Test. No result is shown.', status: 503 },
};

export function loggingTestNotice(result: DestinationTestResult): LoggingNotice {
  const notice = result.status === 'tested' ? sendNotices[result.outcome.kind] : operationNotices[result.status];
  return { ...notice, message: `Settings saved. ${notice.message}` };
}

const requestNotices: Readonly<Record<FormRefusal | 'changeStale' | 'methodNotAllowed', LoggingNotice>> = {
  invalidRequest: { title: 'Check settings', message: 'The form is not valid. Read saved settings and check the destination, dataset, and Bearer token.', status: 400 },
  forgedRequest: { title: 'Form refused', message: 'The form is not from this site or is no longer valid. Read saved settings before another change.', status: 403 },
  formTooLarge: { title: 'Form too large', message: 'The form data is too large. Read saved settings before another change.', status: 413 },
  formTypeRefused: { title: 'Form not accepted', message: 'This page accepts only HTML form data.', status: 415 },
  changeStale: { title: 'Settings changed', message: 'The organization or saved settings changed. Review the current settings before another change. No Test was sent.', status: 409 },
  methodNotAllowed: { title: 'Method not allowed', message: 'This page does not accept this request method.', status: 405 },
};

export function loggingRequestNotice(name: keyof typeof requestNotices): LoggingNotice {
  return requestNotices[name];
}
