# S2.5-01b coordinator quality review

## Recommendation

Keep the three private source files. I found no useful small refactor that
removes a decision or makes the required order clearer. The files separate
durable removal flow, current membership rules, and operation lifetime. More
files or a general operation framework would spread these same rules across
more call sites.

No source was changed for this quality review. The manager accepted the reasons
and added the three MI exceptions in the committed candidate. Required human
review remains separate. These exceptions do not waive test, CRAP, or
architecture gates.

## Measurement and provenance

After the first inspection, the manager requested a type-only contract move.
`MemberRemovalRequest` and `RemovalResult` now live in the public
`removal-operation-store.ts` module so their definitions appear in API
snapshots. The private files import these types. No method changed.
The move passed `npm run typecheck`, all 70 focused removal cases, API snapshot
generation, and the scoped diff check. See
`../checks/coordinator-public-types-{tests,typecheck,api}.log`.

Final values below come from the manager's post-type-move snapshot at
`d75b8676cbbc37be2f69356d577ade1ffb87b783`, stacked on
`122d65bf1f035fc195792cc083732aa05c423c58`. The later comment correction
`fb9b0fd09991747a38ca8b06f63e30e55ef0853e` changes only
`change-records.ts`; these three source blobs are unchanged. This report was
refreshed on 25 October 2026 by reading the existing snapshot and committed
blobs. No metric command ran for this refresh.

For each file below I ran:

```sh
pnpm exec node script/code-quality/ast-metrics-mcp.ts file <path>
```

All three initial inspection commands completed. They ran no build, coverage
capture, or test suite. They inspected the first measurement; the manager
performed the one post-type-move measurement. The final raw scores below come
from the matching `ast-report/snapshot.json`; the MCP summary prints one
decimal place.

| File under `src/accounts/organizations/` | Raw MI | Tool lines | File paths | Largest function | Committed minimum MI |
| --- | ---: | ---: | ---: | --- | ---: |
| `membership-removal.ts` | 43.6798696390541 | 79 | 32 | `complete`: 9 paths, 13 lines | 43.67 |
| `membership-removal-checks.ts` | 56.89018621554175 | 50 | 42 | `checkRemoval`: 9 paths, 15 lines | 56.89 |
| `membership-removal-lifetime.ts` | 73.50007134856634 | 51 | 15 | `finish`: 4 paths, 8 lines | 73.50 |

Each committed entry uses `metric: mi` and expiry `2026-12-24`. The
bounds are below the raw values. In particular, a bound of 43.68 would fail
against the first raw value after display rounding.

Source SHA-256 values:

- `membership-removal.ts`: `1679eae1caad8768b53f99b78658b70033cdd608246f3b88b34c059ef826febd`
- `membership-removal-checks.ts`: `fcfda7a175d95af3d945f218b3cbfb487814d99cf04525112f8d29aec24768a5`
- `membership-removal-lifetime.ts`: `79a0050baa0dea9a135bc009f4dbb20ff0bf9ac54aa00412b6b6c667369d9830`

### Measurement history

The first inspection at `5876bc466c44985035a258709f27a0a3cd158b9b`
preceded the public type move. Removal had MI 43.6798696390541 and 82 tool
lines; checks had MI 56.3920243491198 and 55 tool lines; lifetime had MI
73.50007134856634 and 51 tool lines. Its source SHA-256 values were,
respectively, `b107594423245b426e233b1bab7e818f5e39e00703695f794ebd5d97dc060e8f`,
`75e0c899c152563e9052fbe349801a026ceb796d9cad2bf9ee690265394a3dcc`, and
`206776bd893ac790097aaabb67aa788e60c731cbe267367d10040144581a07e5`.
These values are history, not current-candidate evidence. The public type
move changed no function body or decision-path count.

## Retained findings and exception reasons

### `src/accounts/organizations/membership-removal.ts`

One removal owner keeps initial authority, durable admission, admitted checks,
single dispatch, and conditional completion in order. Its largest function has
nine paths. Completion must distinguish a confirmed write, an explicit
mismatch, and an uncertain write, then require the same organization,
operation ID, and terminal outcome in a durable receipt. The adjacent catch
boundaries keep a read refusal separate from a possible provider effect.

The other main methods are small: `admit` has five paths in eleven lines and
`admitted` has six paths in sixteen lines. Moving completion to a separate
object would add a second coordination object without removing its store,
intent, lifetime, or result dependencies. A result table or generic retry
wrapper would hide which answers permit completion. Keep the explicit flow.

Reason retained:

> One removal owner keeps authorization, durable admission, current checks,
> single dispatch, and conditional terminal receipts in one ordered flow.
> Its largest function has nine paths. Focused cases cover ambiguous admission,
> provider uncertainty, completion mismatch, and exact receipt matching.
> Further splitting would spread the no-replay and completion authority rules
> without reducing their decisions.

### `src/accounts/organizations/membership-removal-checks.ts`

One rule file evaluates the facts used by the last-Admin decision. It preserves
the direct target facts before later reads, reads every bounded active-member
page, uses the later duplicate record, and reconciles the target before it
counts Admins. The actor, target, and remaining Admin count use current facts.
The largest function has nine paths. `targetRefusal` has eight paths in seven
lines for separate unsafe dimensions.

The grant checks have two different uses: support for deleting every target
role, and the permissions that make an Admin usable. Combining them would
change the rule. Replacing explicit refusal guards with a validation table
would make their result precedence harder to review. Extracting each guard
or comparison would move details away from the decision they protect.

Reason retained:

> One rule file keeps current actor authority, exact target facts, all raw
> grant support, complete bounded member pages, and the last-Admin decision
> together. The largest function has nine paths, covered by focused refusal,
> pagination, duplicate, and target-change cases. Separate rule objects or
> per-guard files would hide the order that prevents a stale User-to-Admin
> transition from bypassing the last-Admin check.

### `src/accounts/organizations/membership-removal-lifetime.ts`

One lifetime owns the monotonic deadline, public result, continuation guard,
read signal, and irreversible stop. Its largest function has four paths.
The admission flag must distinguish unavailable initial work from a possible
committed intent. The stopped flag prevents any late continuation or result
from starting more work. Timer and guard checks are both needed: a delayed
timer callback must not permit dispatch after the monotonic deadline.

The timer callback `() => this.stop()` has one path and one line. The MCP
prints a function MI of zero for that callback. It is already the smallest
direct delegation; this observation does not invalidate the reported file
MI or justify moving the timer out of its owner.

Reason retained:

> One small lifetime owns the total deadline, admission uncertainty, read
> cancellation signal, guarded continuations, and one public result. Its
> largest function has four paths. Tests cover the exact deadline, accumulated
> phase time, close, late replies, and signal propagation. Splitting timer,
> stop, or result state into another owner would obscure their release-once
> and no-late-dispatch guarantees.

## Parameter-count findings

Keep the explicit per-operation arguments. The current declarations have
four arguments in `checkRemoval`, five in `admitted`, and five in `complete`.
The earlier shorthand of four/six does not match these current declarations.

`checkRemoval` needs the directory, actor, request, and guarded read operation.
`admitted` needs the actor and request plus the admitted intent, available store,
and lifetime. `complete` needs the store, exact intent, expected terminal
outcome, caller result, and lifetime. The store is explicitly narrowed from
optional storage before admission. The intent and lifetime belong to this
call; they must not become mutable shared service fields.

A parameter bag would only rename the list. A second operation object would
mainly forward these values and duplicate the existing lifetime owner. Keep
the small private helpers and record this reason for the hook findings.

## Verification limits

The unchanged source has 70 focused removal cases and 150 organization cases
passing in `../checks/coordinator-signal-green.log`. The provider lifetime
correction also has six composed cases passing in
`../checks/provider-lifetime-bdd-green.log`. Earlier red evidence remains in
the matching coordinator and provider logs.

These counts support behavior; they do not establish complete branch coverage
or a CRAP result. The manager owns the complete-candidate coverage, CRAP,
full-suite, architecture, and human-review decisions. No coverage report was
edited or regenerated for this review.
