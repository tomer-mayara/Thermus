import type { AuditSendOutcome } from '../../../logs/audit/audit-send.ts';
import type { DestinationTestResult } from '../../../logs/audit/destination-settings-service.ts';
import { loggingNotice } from './logging-page.ts';

interface TestNotice { readonly title: string; readonly message: string; readonly status: number }

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
  unsaved: { title: 'Save before Test', message: 'Save your edits before Test. Test uses only the saved destination.', status: 409 },
  busy: sendNotices.busy,
  cancelled: sendNotices.cancelled,
  unconfirmed: { title: 'Test result suppressed', message: 'The current saved destination could not be confirmed. Read saved settings before Test. No result is shown.', status: 503 },
};

export function loggingTestAnswer(result: DestinationTestResult, loggingPath: string): Response {
  const notice = result.status === 'tested' ? sendNotices[result.outcome.kind] : operationNotices[result.status];
  return loggingNotice({ ...notice, message: `${notice.message} Test proves neither continued delivery nor durable storage. Test is not required to enable export.` }, loggingPath);
}
