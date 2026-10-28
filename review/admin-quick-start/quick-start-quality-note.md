# Admin Quick start quality dispositions

Date: 28 October 2026. These measurements and the refactor result were supplied
by the manager after the page worker's focused improvement pass. Final metrics
will confirm the values and exception bounds on the complete candidate. This
note is review evidence, not a final metric-process pass. The manager later
supplied the base/head snapshot values below. The formal process and CRAP
assessment remain pending. All tracked files are frozen; this follow-up edits
only this ignored note.

| Production file | Measured file MI | MI exception floor | Expiry |
| --- | --- | --- | --- |
| `src/interfaces/web/account/quick-start-page.ts` | 57.2 after refactor; 62.8 before | 57 | 2026-12-27 |
| `src/interfaces/web/account/quick-start-content.ts` | 54.0 | 53.5 | 2026-12-27 |

Only these two file-specific MI entries were added to
`.code-quality-exceptions.yaml`. They do not change the MI 85 default, CRAP
goals, coverage rules, or the treatment of another file. They do not authorize
a tool failure or missing evidence. A final score below either floor needs a
fix or a new reviewed disposition; the exception is not an automatic pass.

## Page renderer

The worker replaced one large interpolation with named local render helpers
for the header, provider row, three steps, and full manual guide. This is a
meaningful separation within one page renderer. The main function improved
from MI 63.6 to 71.9 and has one path. The manager reports that the before/after
DOM and CSP bytes match and the refactor check passed. The aggregate file MI
fell from 62.8 to 57.2; the function improvement does not turn that file result
into a metric pass.

The retained file has one page contract: the three setup steps, always-visible
Audit switch/recovery/delivery notes, full selectable guide, escaped trusted
organization text, configured links, and the shared administration layout's
exact CSP hashes. The source-owned render helpers keep those parts legible.
Moving each section into another file only to improve a file score would
spread the same content/escaping/layout contract without a distinct invariant
or lifetime. The narrow floor is 57, 0.2 below the measured file score, with
the stated expiry. The full measurement reports must remain linked in review.

## Canonical content and link safety

The content owner keeps the approved prose/provider links and the complete
Markdown assembly together, so visible content and copy cannot silently become
different guides. It also owns configured URL validation, Markdown text
escaping, and link-target escaping. Its measured MI is 54.0. The largest
function has six paths in URL validation: those paths reject a different
unsafe URL property, rather than combine unrelated business decisions.

The full copied content matched the approved guide's 23 paragraphs after
line-wrap normalization and all six headings exactly. Unit cases address
Markdown syntax/entity names and link parentheses. The retained canonical
owner makes those checks apply to the content used by both page and copy.
Per-section files or per-guard wrappers would spread this same content/link
contract without removing its necessary validation decisions. The narrow floor
is 53.5, 0.5 below the measured file score, with the stated expiry.

## Existing changed files below MI 85

These are the manager-supplied snapshot values. Each result below 85 remains a
recorded goal miss; a small delta or an existing low baseline is not a claim
that the default goal passed. No additional exception was added for these
existing files. The final checker must apply the trusted existing-file and
exception rules to its complete evidence.

| Existing production file | Base MI | Head MI | Delta | Retained disposition from the code |
| --- | --- | --- | --- | --- |
| `src/interfaces/web/account/members-page-layout.ts` | 80.3696 | 68.6940 | -11.6756 | The shared renderer now chooses the optional Quick start link/current-page state and the exact additional style/script CSP hashes. It keeps navigation, current markers, escaped workspace data, rendered bytes, and their policy in one owner. The 13 paths are presentation-presence/current-page choices and hash-presence guards, not extra authorization or write algorithms. See the specific retained-drop reason below. |
| `src/interfaces/web/account/account-routes.ts` | 54.0304 | 50.3440 | -3.6864 | The new guide is a short protected route behind the existing session/current-access boundary. It requires matching current Admin scope, permits only GET/HEAD, checks cancellation around the existing authorized name read, refuses missing/mismatched/blank names, and uses trusted configuration for rendering. Keeping those gates beside the session/cookie/failure owner prevents a second route owner from making different selection or cookie assumptions. Content, markup, style, and clipboard behavior are already separate focused modules. |
| `src/app/application.ts` | 55.4483 | 55.3846 | -0.0637 | The actual increment is one configured `mcpResourceUrl` supplied to web. App remains the composition and cleanup owner: provider/service roles are constructed once, requests share the shutdown signal, removal work stops before SQL closes, and close failures remain observed. Moving one field's wiring elsewhere would separate trusted configuration from the owner that supplies the rest of the route contract. |
| `src/interfaces/user-portal/portal.ts` | 48.7609 | 48.6046 | -0.1563 | One additional presentation condition puts Quick start first only when the current server product-access roles include exact Admin. The page still reads session before access, displays server values as text, keeps Connect current, and grants no authority through link visibility. Keep this small menu decision with the existing role-dependent menu; a second menu owner would split one presentation rule without a new lifetime or access check. |
| `src/interfaces/web/account/administration-pages.ts` | 60.3372 | 60.3372 | 0 | The changed declaration adds an optional navigation destination. The renderer still consumes both complete member/invitation overviews, escapes provider text, displays pending-seat facts, and emits only supported protected forms. This is one Members render contract, already using the shared shell. A type-only navigation addition does not justify moving those completeness/escaping rules across files. |
| `src/interfaces/web/account/administration-routes.ts` | 51.2323 | 51.1726 | -0.0597 | The increment supplies a Quick start navigation path when rendering Members. The owner still derives actor/organization from the decided context, obtains both overviews before rendering, and keeps method/origin/form-token/stale-target checks and one-write outcome recording together for mutations. The new link is read-only. Retain this admission/outcome boundary instead of splitting existing write and recovery semantics to improve a file score. |
| `src/interfaces/web/account/logging-routes.ts` | 47.9085 | 47.8893 | -0.0192 | The increment adds a fixed Quick start path to the navigation map. Read/Save/Test remain separate operations under current Admin authority, and Save-before-Test, revision-aware feedback, fixed unavailable responses, cancellation, and credential-cause containment remain in the same boundary. A navigation change gives no reason to distribute those interdependent save/recovery rules or create a second path policy owner. |
| `src/interfaces/web/account/organization-selection-page.ts` | 65.6762 | 65.3010 | -0.3752 | The optional trusted `admin` presentation input now adds Quick start before the ordinary Connect/selector links. Native forms, escaped names, CSRF/organization/return fields, Switch Workspace's current marker, and JavaScript-free selection stay together in one picker render. Keep the additional menu branch with the rest of that render; it does not add selection authority or another request. |
| `src/interfaces/web/auth/workos/workos-signup-routes.ts` | 40.5418 | 40.5347 | -0.0071 | Only the successful checked-switch destination changes from root to Quick start, with its private property renamed to say that purpose. The same owner still validates enabled legal scope, bounds POST admission, tracks pending remote work after disconnect, preserves cookies, and separates activation/selection from fixed failures. Keeping the redirect beside that successful-switch result preserves the rule that failed selection cannot repeat a grant. |

## Shared-layout MI drop retained after review

The layout drop of 11.6756 exceeds the five-point informational-note threshold.
It must remain visible in Quality review, with both snapshot values and the
reason. The drop is not a separate review tier and is not described as a pass.

The added branches have direct visible purposes: omit the Admin-only Quick
start link when no destination is supplied, mark the correct page, select the
page's layout class, and include optional page-specific style/script bytes with
only their exact SHA-256 CSP allowances. The pre-existing optional Audit link
and workspace name remain in the same shell. Dynamic navigation/title/name
values are escaped. Source-owned content/style/script inputs are constructed by
the page renderers; an untrusted request supplies none of those raw bytes.

The implementation creates a fresh `Headers` for each response and starts from
the shared base policy. It computes hashes from the actual optional strings
that it emits, preserving the base style hash and avoiding broad inline/eval
permissions. Keeping emitted assets and allowed hashes in one owner prevents
the page and policy from drifting and avoids response-to-response policy
mutation. The extra branches do not choose an organization, confer an Admin
role, or send a write.

Focused Quick start unit cases inspect exact script/style hashes, escaped text,
the full guide, visible Audit notes, and denied active/credential-bearing URLs.
The existing Members/Audit unit/integration contracts retain their forms,
current-page markers, escaped names, and navigation expectations. Real Chromium
cases cover Members, Audit, Connect, the picker, and Quick start with keyboard
use, narrow layouts, JavaScript on/off, and copy success/fallback. Those cases
provide behavior evidence across the shell's consumers; they are not a claimed
numerical coverage percentage. Final coverage provenance and CRAP remain the
separate process's responsibility. See Validation for each run's exact scope
and candidate.

Retain the 13-path shared renderer with this reason. A helper per condition or
another page-specific shell would mainly move counters or duplicate the same
navigation/CSP contract. No new helper split or MI exception was introduced to
make this existing file appear to meet the goal.

## New string-constant modules and measurement limits

`src/interfaces/web/account/quick-start-copy.ts` has zero parsed functions and
no MI in the source snapshot. It exports the browser program as a string that
the page embeds and authorizes with a CSP hash. The AST analysis therefore does
not numerically assess the JavaScript inside that string. Its missing MI is
not 100, and zero parsed functions is not a claim of zero browser complexity or
full client coverage. Direct VM unit outcomes exercise successful, denied, and
unavailable clipboard writes; real browser keyboard/copy cases exercise actual
page loading, manual selection, status, and copy behavior. Those checks verify
the tested outcomes without extending the numeric source-analysis claim.

`src/interfaces/web/account/quick-start-style.ts` likewise has zero parsed
functions and no MI because it is a stylesheet string constant. Its stylesheet
is assessed through the exact page/CSP relationship and browser layout, focus,
overflow, and narrow-screen checks. It has no function metric to report and
must not be labelled MI 100 or fully covered client code.

## Review and evidence limits

Using a permitted metric exception adds a T1 Team review reason. The candidate
already requires T2 Need architect for its new browser contract and app-to-web
interface; the exceptions cannot reduce that tier or waive independent approval
of the final SHA. The checker must verify the committed exceptions and actual
final measurements. CRAP goals remain separately assessed.

The final habit-hooks scan, `ast-report/habit-hooks-final.log`, completed with
exit 1 and 81 retained findings: 8 complexity, 2 non-null assertions,
6 parameter, 57 comment, and 8 size findings. Nine new assertions from the
earlier 90-finding scan were removed. The retained reasons and failure/fix
history are in `quick-start-habit-review.md`. The snooze file is `[]`.

This worker added only the two exception entries and updated ignored review
notes for this follow-up. No source/test change, test run, metric run, scanner
run, dependency install, commit, or publication was performed.

The later snapshot-disposition follow-up changed only this ignored note. The
tracked candidate, including root impact metadata, remains frozen so active
coverage fingerprints cannot change.
