# Focused ownership guard review

Decision: approved for the manager-authorized full PR255 live gate. No concrete blocking bug found. This is code review, not a gate pass. No executable check or provider call was run by this reviewer.

The renewed user request authorizes a fresh full attempt. This supersedes the earlier unchanged-retry hold in the first review.

Reviewed facts:

- preload.mjs:6 resolves ../../../ from the guard file to the repository root. Lines7-8 restrict activation to child-v8 workers at four exact emitted test paths. Builds, npm, Vite and unselected children stay inactive. SDK import and prototype mutation occur only inside that condition.
- The preload and emitted settings/public-proof modules use the same root @workos-inc/node ESM export (SDK11.0.0 lib/index.mjs). Its Connect, UserManagement and Organizations sections use shared class prototype methods; constructors create section instances of those classes. No competing CJS import appears in these emitted helpers.
- ownership-guard.mjs:25-53 covers all three root-resource section prototypes. Successful creates record returned exact IDs. Allowed deletes call the original with the same receiver and all arguments, return the original result and rethrow the original error. Existing list methods are untouched. Unknown or invalid IDs throw before DELETE callthrough.
- Personal organization adoption at54-65 requires a currently owned user, known schema, and both requested and returned deterministic externalId. The hash matches signup-fixtures.ts and workosAuthority(clientId). It does not grant ownership from a broad name or email prefix.
- preload.mjs:14-18 rejects symlink journals, nonregular files, other owners, mode other than0600 and prior rows for another run. Runner supplies a fresh journal and run ID per command. Journal events include owned IDs/status only, not payloads, credentials or arbitrary error messages.
- Existing raw consent revocation fetch calls are outside the root-resource SDK guard. The reviewed source targets freshly owned users/applications; describe the guard scope accurately.

A claimed gate pass still needs the agreed head/input and guard hashes, guard-active receipts for each selected file worker, zero delete-denied events, no journal failure, and full actual command counts. A blocked deletion makes the run fail; it must never be omitted, converted to a no-op or called a passing modified diagnostic. Source, compiled tests, SDK files, assertions, deadlines and retries stay unchanged. No additional verification gate is requested.

Reviewed file hashes:

- guard/preload.mjs: 604db4659af1b843ffd046bb9fa37f31102b721bb7e871aa64ac0c59cdbfacaf
- guard/ownership-guard.mjs: 625645ba65673975b89b8b4821116115cd643fb3662751eed93d0a79a8eabc70
- guard/manual-selfcheck.mjs: d9a2feef620878d6b8e64c664c26b8ad4037fd3128899c4f11c29c89ab44abfe
- guard/worker-probe.mjs: 5b86812557e3d1a73ebf5bd92ce3f828657f4329f9b6c071fb2e2b4c619480a0
