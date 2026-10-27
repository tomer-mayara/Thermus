# Workspace selection review — new-base draft 3

Trusted base: `f6b523967223da5ebddafdef1a508d3936cee01c` (merged SO-03 / PR280).
Combined source candidate: `7b46dca42c17ead64263339fd638f39ccb693a0d`.
Previous reviewed picker source: `16c8e174f503f79c5011fe9ac7e157578ff49d74`.
Previous final-head bridge: `2907d105f85c9596401312d7082af86a5711df06`.

Status: independent read-only source, architecture and release-compatibility
review finds no actionable integration blocker. New-base candidate tests,
metrics/checker and current-head human architect approval remain pending.
Old v2, metric and final-head reviews remain unchanged as historical evidence.
No old-base test result is relabelled as a pass of this merged candidate.

## Increment against the new base

The three picker production files are byte-identical to reviewed source 16c8e174.
The new-base increment still changes only the picker fallback, optional menu access
lookup, native picker menu/style, related tests and design/registry prose, plus
the fresh impact declaration and any required generated metric record.

SO-03's tenant container, signed context, token-verifier extraction, audit relay,
configuration declarations, security-policy entries and public module are already
in the trusted base. They are not new architecture facts of this picker increment.
Compare and classify against f6b52396, not the earlier 77477864 base.

The relevant production owners remain web, organizations and workos in the
control-plane Node container. The supplementary L3 diagram names that container
explicitly. The inherited tenant Node container has no picker or browser session
routes and is omitted. No request from the picker is sent to a tenant, gateway,
signed-context verifier or audit relay.

## Actual behavior and authority

- Bare GET/HEAD organizations emits selection forms with return_to equal to the
  normalized public base pathname. A successful POST therefore opens Connect.
  A safe explicit path, including organizations itself, remains exact. The return
  path validator and form contract are unchanged.
- Identity still admits the picker. The authorized list is read first. Only when
  the session-selected workspace is in that list does the optional access lookup
  run. Its allowed context must match both selected-organization fields, session
  subject and authority, a nonempty tenant, product:access and an exact admin grant
  with nonempty permissions. Another workspace's Admin grant supplies no links.
- Denial or mismatch returns the basic menu. A thrown lookup reports fixed Error
  text with its cause attached and returns false. The existing System-log reporter
  stringifies the outer fixed text. Abort is checked before returning the access
  result and before reporting a lookup failure; it propagates without a page or
  report. A failed organization list retains the prior request-failed response,
  not a successful partial picker.
- POST still checks method, exact Origin, bounded form and CSRF, validated return
  path, current eligible membership, then one session switch. No optional access
  lookup is added to POST. Session cookies still precede switch cookies. Refusal,
  sign-out, operation failure, other browser sessions and MCP-token organization
  bindings retain their behavior. The POST/switch bodies remain unchanged.
- The menu uses escaped base-aware native anchors, one Workspace navigation region
  and Switch Workspace as its current page. Main is focusable for Skip to content.
  Organization controls remain native POST forms with no script requirement; CSS
  retains its content-derived CSP hash.

## SO-03 compatibility with existing production

Source inspection confirms no new setting or migration is needed to retain the
current hosted control-plane behavior. deployment-config.ts selects control-plane
for undefined, empty or exact control-plane THERMUS_ROLE. Only explicit tenant
loads the four tenant settings and enforces the tenant-secret refusal. Application
composition calls openTenantApplication only for config.role === tenant; otherwise
it still opens openWorkOSApplication and the existing browser/account/portal flow.
The source tests for absent/empty/control-plane selection explicitly cover this
default. These are inspected test definitions, not a new test run by this reviewer.

openWorkOSApplication still reads existing WorkOS/signup/renderer/portal/storage
settings. It does not require GATEWAY_PUBLIC_KEY, TENANT_ORGANIZATION_ID,
CONTROL_PLANE_INTERNAL_URL or a signing key. FREE_TENANT_LIMIT is inherited from
SO-04, has its existing default 25, and requires no new environment value. The
inherited tenant-registry objects have constructors with no SQL work; no current
request route calls their lookup/request operations. No tenant-table query or
migration is introduced by opening the picker or by default control-plane startup.
This does not claim that future tenant provisioning can run without its schema.

SO-03 extracts WorkOSTokenVerifier and delegates WorkOSAuthProvider.verifyAccessToken
to it. The extracted token-verification body is identical to the prior provider
body. More directly relevant, the provider's resolve plus optional userName bodies
are byte-identical to the old base. Hosted composition still supplies the same
WorkOSOrganizations grant reader and userManagement client to WorkOSAuthProvider.
The picker therefore keeps exactly the selected-workspace access path reviewed in v2.

That path validates authority/selected ID locally, reads one active matching
membership filtered by user and organization with limit 10, rejects duplicate,
paged or mismatched responses, then reads its role catalog. Successful production
resolution also attempts the existing optional profile read, whose failure is
ignored and whose result gives no menu authority. The preceding authorized list
still reads active membership pages and organization role catalogs. All WorkOS
calls retain zero retries and the existing 5-second per-call timeout.

Gateway and /internal/audit admission remain planned SO-05 work in the new base.
The current control-plane browser path does not invoke them. Do not turn their
planned status into a new blocker for this navigation release or claim their
production verification. Fresh production readback must still confirm that
THERMUS_ROLE is absent, empty or control-plane and preserve the existing settings;
this reviewer made no production call or configuration change.

## Registry, public surface and comparison

The new base has **17 Mermaid blocks** and **51 tracked declaration files**.
All 17 block bodies and all 51 snapshot file bytes match the merged working tree.
registry-inventory-v3.json retains every heading, bounds and block hash. The picker
adds prose only. The inherited tenant view and signed-access-context declaration
must remain in the current map/inventory; old counts 16/50 are historical.

Checked Context, hosted containers and source-owner mapping, hosted authentication
components, inherited tenant components, collaboration overview, default sign-in
landing, member-read prose, deployment, ownership and behavior/resource ownership.
The existing hosted-authentication view already shows web using session/access and
organization roles, so no registry diagram edit is needed. The new caller phase
is shown in the supplementary L3 comparison and described in registry prose.

The source is architecture-comparison-v3.mmd. Existing runtime calls remain neutral;
web behavior changes are amber, and the added optional picker access call is green.
The short neutral Auth/switch label condenses session authentication and the
POST-only switch. App construction, identity-owned contracts, unrelated account
operations, tenant composition, gateway/relay and MCP are omitted for focus. The
unchanged external WorkOS HTTPS edge remains neutral; its new picker caller is
named on the added internal arrow. The tenant container is inherited and omitted,
not represented as a new component inside this control-plane view.

The strongest changed callable behavior remains GET organizations with omitted
return_to and the subsequent 303 destination. No new public callable is added.
L3 plus the four before/after notes answer redirect compatibility and optional
lookup phase/authority/recovery. L4 would repeat local branches without exposing
an additional boundary or rule, so omit it for that reason. Do not claim that no
observable callable contract changed.

## Tier and flags

The new-base policy still selects **T2 Need architect** for contract=true and
internalInterface=true. The former records the changed emitted return/default303
across browser/server; the latter records new GET/HEAD runtime use of the supplied
resolver. All other flags remain false for this increment: no new container,
external integration, deployment guarantee, cross-cutting trust pattern, component,
sensitive authorization/session/recovery rule, dependency, or policy. The input
and failure semantics are understood, so uncertain=false. Inherited SO-03 flags
do not describe this increment and must not be copied into its declaration.

Current-candidate independent authorized human architect approval is required.
Agent and manager review do not provide that human approval. The final checker
may report additional facts/blockers and must use the new actual base/head pins.

## Evidence refresh and retained limits

Root will refresh the complete merged candidate's ordinary tests, types, portal
build, hosted build/AMD64 image, self-hosted container, browser runtime, habit-hooks,
selected unit+integration coverage, snapshots/process/CRAP and review checker.
Hosted-live stays selected because picker GET adds WorkOS organization reads.
The old-base live run remains valid only for its isolated original input scope;
it is not new-base proof. No port, process or MCP operation was started here.

The picker increment alone does not select PostgreSQL/Collector/renderer runtime
repeats. If root's complete-candidate-versus-deployed release assessment selects
additional gates for inherited main changes, retain that distinct selection and
its provenance. Do not treat new-base inheritance as a reason to erase a required
release check or to relabel an old run.

The two inspected old-base picker screenshots still describe byte-identical picker
CSS/HTML, but they are not screenshots of a fresh merged run. Added picker browser
cases use short names at normal text; no picker-specific 200%/long-name browser
layout is claimed. No-JavaScript proof establishes picker/native selection,
Connect URL and persisted selection, not rendering JS-dependent Connect content.
These limits remain recorded; manager requested no added tests for them.

Manager approved the v3 control-plane diagram at native 798px for this exact
7b46/f6B comparison without changes. The committed candidate pin, exact source
hashes, unchanged POST bodies, 51-snapshot tree and 17-view comparison are in
source-review-provenance-v3.json. Pending: fresh complete-candidate
gate/metric/checker evidence and current-head human architect approval. Preserve v2 and both old final-head bridges unchanged.


## Browser readiness correction on the merged candidate

The actual helper correction is one line in WorkspaceSelectionBrowser.chooseOrganization.
After the native selection navigation and exact root URL check, JavaScript cases
now await the exact chosen Workspace label to be visible. It replaces an immediate
isVisible snapshot that could run before the portal's asynchronous session/access
reads completed. waitFor uses the existing page timeout; no fixed sleep or larger
allowance is added. Failure to render that exact selected-workspace label still
fails the test. The root redirect, re-opened selected button, role-specific menu
and one protected POST checks remain intact. No-JavaScript behavior is unchanged.

This correction is independently signed off as a test readiness fix. Preserve the
initial two mobile JavaScript failures and their actual candidate scope. The fresh
83-case browser rerun belongs to the corrected helper and merged source candidate;
this review does not assert its result before completion. The helper's before/after
hashes and decision are in new-base-compatibility-v3.json.


## Fresh production role and committed input facts

The manager reports a fresh Render dashboard readback with THERMUS_ROLE absent
from all 14 masked environment variables and no linked environment groups. This
is current production configuration evidence from the manager, not a new
production read by this reviewer. Together with the inspected default selector,
it confirms the deployed image keeps the control-plane role without a new
configuration value or migration for this browser workflow. No tenant runtime
or relay activation is requested by this picker release.

All incremental source/test/docs/impact file bytes match committed head 7b46dca4.
The three picker production files remain identical to old reviewed source 16c8e174.
The selection POST and switchAnswer bodies remain identical to the new trusted
base. The 51 public snapshots share one exact Git tree object at base/head; all 17
registry diagram bodies match. These facts do not replace the final emitter/checker.

Manager reports the corrected focused 57/28 cases and 83 browser cases passed,
along with typecheck and backend/portal builds. Original logs retain execution
pins and the initial browser readiness failures. The complete new-base ordinary
suite, metrics, image/container and live evidence remain in progress. Old-base
coverage/results remain preserved and are not relabelled as new-base results.
