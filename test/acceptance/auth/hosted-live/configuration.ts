import { assertProviderMfaProfile } from '../../../support/hosted-live/mfa-profile.ts';
import type { LiveRun } from '../../../support/hosted-live/live-run.ts';
import { field, queryWidgetGraph } from '../../../support/hosted-live/workos-api.ts';

const authenticationSettingsQuery = 'query { authenticationSettings { mfaEnabled mfaRequired passkeyAuthEnabled passwordAuthEnabled } authkitSettings { origin } }';

export async function assertMfaProfileBeforeLiveProofs(run: LiveRun): Promise<void> {
  const { twoOrganizationUser, organizationA } = await run.fixtures();
  const { token } = await run.workos.widgets.createToken({ organizationId: organizationA.id, userId: twoOrganizationUser.id, scopes: ['widgets:users-table:manage'] });
  const data = await queryWidgetGraph(token, authenticationSettingsQuery);
  const authentication = field(data, 'authenticationSettings');
  assertProviderMfaProfile(run.settings.mfaPolicy, authentication);
}
