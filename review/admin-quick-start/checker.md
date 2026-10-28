## Review tier

Tier: `T2 Need architect`
Local eligibility: `eligible`
Architecture: T0: no architecture fact
Candidate: f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e
Merge base: feeaad4d5f04212f033366c232180be4bd40da4c

Architecture facts:
- none

Reasons:
- T2 Need architect impact.contract: Admin Quick start adds GET/HEAD quick-start in the existing web owner. The route requires the session-selected organization, matching current identity and organization, product access, exact Admin role, and a current nonblank organization name from the existing authorizeSelection read. App supplies the configured MCP URL through a new required HostedAccountRoutesOptions member. After successful new-organization activation and checked session selection, signup redirects to Quick start instead of the portal root; later sign-ins and normal workspace selection retain Connect. The page renders the complete setup guide and Markdown copy with trusted configured URLs and safe manual fallback. Current-Admin menus put Quick start first. Existing components, dependencies, providers, stores, and deployment remain unchanged. Registry prose records the guide, navigation, and creation landing; all 20 Mermaid views remain unchanged.
- T2 Need architect impact.internalInterface: Admin Quick start adds GET/HEAD quick-start in the existing web owner. The route requires the session-selected organization, matching current identity and organization, product access, exact Admin role, and a current nonblank organization name from the existing authorizeSelection read. App supplies the configured MCP URL through a new required HostedAccountRoutesOptions member. After successful new-organization activation and checked session selection, signup redirects to Quick start instead of the portal root; later sign-ins and normal workspace selection retain Connect. The page renders the complete setup guide and Markdown copy with trusted configured URLs and safe manual fallback. Current-Admin menus put Quick start first. Existing components, dependencies, providers, stores, and deployment remain unchanged. Registry prose records the guide, navigation, and creation landing; all 20 Mermaid views remain unchanged.
- T1 Team review read_paths: .code-quality-exceptions.yaml
- T1 Team review ratchet.exceptions: src/interfaces/web/account/quick-start-content.ts covered by "One canonical content owner keeps the approved setup prose and provider links with full Markdown assembly, trusted URL validation and Markdown escaping so the page and copied guide cannot drift. File MI is 54.0 and the largest function has six paths in URL validation. The complete copied guide matches the approved paragraphs after line-wrap normalization. Per-section files or per-guard wrappers would spread the same content and link-safety contract without reducing its decisions." until 2026-12-27
- T1 Team review ratchet.exceptions: src/interfaces/web/account/quick-start-page.ts covered by "One page renderer keeps the three setup steps, visible audit limits, complete manual guide, escaped organization text and configured links under the shared administration layout and exact CSP hashes. Focused render helpers improve the main function MI from 63.6 to 71.9 with one path while preserving DOM and CSP bytes; file MI is 57.2. Splitting each section into another file would spread one page contract without a separate rule or lifetime." until 2026-12-27
- T1 Team review impact.sensitiveBehavior: Admin Quick start adds GET/HEAD quick-start in the existing web owner. The route requires the session-selected organization, matching current identity and organization, product access, exact Admin role, and a current nonblank organization name from the existing authorizeSelection read. App supplies the configured MCP URL through a new required HostedAccountRoutesOptions member. After successful new-organization activation and checked session selection, signup redirects to Quick start instead of the portal root; later sign-ins and normal workspace selection retain Connect. The page renders the complete setup guide and Markdown copy with trusted configured URLs and safe manual fallback. Current-Admin menus put Quick start first. Existing components, dependencies, providers, stores, and deployment remain unchanged. Registry prose records the guide, navigation, and creation landing; all 20 Mermaid views remain unchanged.

Evidence blockers:
- none

Questions to answer:
- none

Changed paths:
- M .code-quality-exceptions.yaml
- M .pr-impact.json
- M README.md
- M architecture/components.md
- A docs/design/admin-quick-start/guide.md
- A docs/design/admin-quick-start/mockup-desktop.png
- A docs/design/admin-quick-start/mockup-mobile.png
- A docs/design/admin-quick-start/mockup-provider-details.png
- A docs/design/admin-quick-start/spec.md
- M docs/design/portal-design.md
- A docs/metrics/2026-10-27-feeaad4d.json
- M docs/testing/test-list.md
- M docs/user-portal.md
- M src/app/application.ts
- M src/interfaces/user-portal/portal.ts
- M src/interfaces/web/account/account-routes.ts
- M src/interfaces/web/account/administration-pages.ts
- M src/interfaces/web/account/administration-routes.ts
- M src/interfaces/web/account/logging-routes.ts
- M src/interfaces/web/account/members-page-layout.ts
- M src/interfaces/web/account/organization-selection-page.ts
- A src/interfaces/web/account/quick-start-content.ts
- A src/interfaces/web/account/quick-start-copy.ts
- A src/interfaces/web/account/quick-start-page.ts
- A src/interfaces/web/account/quick-start-style.ts
- M src/interfaces/web/auth/workos/workos-signup-routes.ts
- M test/acceptance/auth/hosted-admin-journey.test.ts
- M test/acceptance/auth/hosted-live/signup-server.ts
- M test/acceptance/auth/hosted-members.test.ts
- A test/acceptance/auth/hosted-quick-start-browser.runtime.ts
- A test/acceptance/auth/hosted-quick-start.test.ts
- M test/acceptance/auth/hosted-signup-presentation.test.ts
- M test/acceptance/auth/hosted-signup-recovery.test.ts
- M test/acceptance/auth/hosted-signup-restart.test.ts
- M test/acceptance/auth/hosted-workos-signup.test.ts
- M test/acceptance/auth/hosted-workspace-selection.test.ts
- M test/acceptance/user-portal/portal.test.ts
- M test/integration/auth/workos-signup-routes.test.ts
- M test/integration/hosted-admin/account-routes-administration-pages.test.ts
- A test/integration/hosted-admin/account-routes-quick-start.test.ts
- M test/integration/hosted-admin/account-routes-workspace-navigation.test.ts
- M test/integration/hosted-admin/fixtures/account-routes-fixtures.ts
- M test/support/drivers/browser/admin-shell-browser.ts
- A test/support/drivers/browser/quick-start-browser.ts
- M test/support/drivers/browser/workspace-selection-browser.ts
- A test/unit/html/quick-start-content.test.ts
- A test/unit/html/quick-start-copy.test.ts
- A test/unit/html/quick-start-page.test.ts
- M test/unit/user-portal/portal.test.ts

Line counts:
- Production: 295 (limit 400)
- Total without generated files: 1279 (limit 1500)

Tests:
- Added test cases: 20
- Removed test cases: 1
- Added skips or todos: none

MI:
- changed: src/app/application.ts: 55.44829031021234 to 55.38463275143598
- changed: src/interfaces/user-portal/portal.ts: 48.760944308877924 to 48.60455929962983
- changed: src/interfaces/web/account/account-routes.ts: 54.03041569685968 to 50.34400283785668
- changed: src/interfaces/web/account/administration-pages.ts: 60.33719717239528 to 60.33719717239528
- changed: src/interfaces/web/account/administration-routes.ts: 51.232309633542094 to 51.17262206513874
- changed: src/interfaces/web/account/logging-routes.ts: 47.90845482720732 to 47.889311839222785
- changed: src/interfaces/web/account/members-page-layout.ts: 80.3695659257948 to 68.69398639898778
- changed: src/interfaces/web/account/organization-selection-page.ts: 65.67616499424597 to 65.30101056915511
- new: src/interfaces/web/account/quick-start-content.ts: 53.95041254701023
- not applicable: src/interfaces/web/account/quick-start-copy.ts: no raw MI in the head snapshot
- new: src/interfaces/web/account/quick-start-page.ts: 57.18060902544582
- not applicable: src/interfaces/web/account/quick-start-style.ts: no raw MI in the head snapshot
- changed: src/interfaces/web/auth/workos/workos-signup-routes.ts: 40.541759185159385 to 40.53467861989658

CRAP:
- src/interfaces/web/account/members-page-layout.ts: membersPageLayout: 13.0
- src/interfaces/web/account/account-routes.ts: account-routes\HostedAccountRoutes.quickStart: 8.0
- src/interfaces/web/account/account-routes.ts: currentAdminAccess: 8.0
- src/interfaces/web/auth/workos/workos-signup-routes.ts: workos-signup-routes\WorkOSSignupRoutes.constructor: 7.0
- src/interfaces/web/account/account-routes.ts: account-routes\HostedAccountRoutes.tenantOperation: 6.0
- src/interfaces/web/account/quick-start-content.ts: trustedUrl: 6.0
- src/interfaces/user-portal/portal.ts: showWorkspaceNavigation: 3.0
- src/interfaces/web/account/organization-selection-page.ts: organizationSelectionPage: 3.0
- src/interfaces/web/auth/workos/workos-signup-routes.ts: workos-signup-routes\WorkOSSignupRoutes.openOrganization: 3.0
- src/app/application.ts: (anonymous): 2.0
- src/interfaces/web/account/quick-start-content.ts: quickStartContent: 2.0
- src/app/application.ts: (anonymous): 1.0
- src/app/application.ts: composeHostedApplication: 1.0
- src/interfaces/web/account/account-routes.ts: (anonymous): 1.0
- src/interfaces/web/account/account-routes.ts: account-routes\HostedAccountRoutes.: 1.0
- src/interfaces/web/account/account-routes.ts: account-routes\HostedAccountRoutes.: 1.0
- src/interfaces/web/account/account-routes.ts: account-routes\HostedAccountRoutes.constructor: 1.0
- src/interfaces/web/account/administration-pages.ts: (anonymous): 1.0
- src/interfaces/web/account/administration-routes.ts: administration-routes\AdministrationRoutes.: 1.0
- src/interfaces/web/account/administration-routes.ts: administration-routes\AdministrationRoutes.membersPage: 1.0
- src/interfaces/web/account/logging-routes.ts: logging-routes\LoggingRoutes.: 1.0
- src/interfaces/web/account/logging-routes.ts: logging-routes\LoggingRoutes.constructor: 1.0
- src/interfaces/web/account/quick-start-content.ts: (anonymous): 1.0
- src/interfaces/web/account/quick-start-content.ts: (anonymous): 1.0
- src/interfaces/web/account/quick-start-content.ts: (anonymous): 1.0
- src/interfaces/web/account/quick-start-content.ts: markdownLink: 1.0
- src/interfaces/web/account/quick-start-content.ts: markdownText: 1.0
- src/interfaces/web/account/quick-start-page.ts: (anonymous): 1.0
- src/interfaces/web/account/quick-start-page.ts: (anonymous): 1.0
- src/interfaces/web/account/quick-start-page.ts: action: 1.0
- src/interfaces/web/account/quick-start-page.ts: quickStartPage: 1.0
- src/interfaces/web/account/quick-start-page.ts: renderAuditStep: 1.0
- src/interfaces/web/account/quick-start-page.ts: renderHeader: 1.0
- src/interfaces/web/account/quick-start-page.ts: renderInternetStep: 1.0
- src/interfaces/web/account/quick-start-page.ts: renderManualGuide: 1.0
- src/interfaces/web/account/quick-start-page.ts: renderProvider: 1.0
- src/interfaces/web/account/quick-start-page.ts: renderUsersStep: 1.0
- src/interfaces/web/account/quick-start-page.ts: step: 1.0
- src/interfaces/web/auth/workos/workos-signup-routes.ts: (anonymous): 1.0
- src/interfaces/web/auth/workos/workos-signup-routes.ts: workos-signup-routes\WorkOSSignupRoutes.: 1.0
- src/interfaces/web/auth/workos/workos-signup-routes.ts: workos-signup-routes\WorkOSSignupRoutes.: 1.0

Metrics:
- Delta: goal miss
- Review: passed
- CRAP: passed
- Architecture: passed
- 0 findings on unchanged files, reason unchanged by this PR

Facts to declare:
- none

Declared facts:
- none

Surface differences:
- src/index.ts (imports changed src/app/application.ts)

Informational:
- 53 public modules, 0 snapshots changed
- public module touched, declarations unchanged: src/index.ts (imports changed src/app/application.ts)
- ratchet.maintainability_index.existing_file_drop_note_at: src/interfaces/web/account/members-page-layout.ts: 80.3695659257948 to 68.69398639898778

Notes:
- Local eligibility is preliminary. The manager or Delamain session must verify current local checks, holds, and required independent human approval.

Label:
`gh pr edit <n> --repo tomer-mayara/Thermus --add-label 'T2 Need architect' --remove-label 'T1 Team review' --remove-label 'T0 Auto merge'`
