## Validation

Candidate: [`3e5931a080c88e0331cdd27cc036b37efbd8d80c`](https://github.com/tomer-mayara/Thermus/commit/3e5931a080c88e0331cdd27cc036b37efbd8d80c). Trusted main merge base: [`7e9cc19a2f4d82620e745273660e35a8f1a151f3`](https://github.com/tomer-mayara/Thermus/commit/7e9cc19a2f4d82620e745273660e35a8f1a151f3). This is the complete increment against main.

The source edit selects the full ordinary suite, typecheck, portal build, self-hosted container, hosted offline build, and Linux AMD64 hosted-image gate. The changed live helper selects the full hosted-live group. Existing Quick start browser checks cover the affected page. No new test case is needed for this small reversible UI edit.

| Check | Result | Evidence |
| --- | --- | --- |
| Focused page/content/copy/composed acceptance | 14/14 passed | [Exact commands and transcribed results](./validation-notes.md) |
| Quick start Chromium, JavaScript on/off | 2/2 passed; closed/expanded views at 320, 390, 1024 pixels; no console/CSP error or overflow | [Raw log](./browser.log), [desktop](./ui/quick-start-1024.png), [mobile](./ui/quick-start-320.png) |
| `npm test` | 5,685 Node + 60 portal tests passed | [Log](./npm-test.log) |
| `npm run typecheck` | Exit 0 | [Log](./typecheck.log) |
| `npm run build:user-portal` | Exit 0 | [Log](./portal-build.log) |
| `npm run test:container` | 11/11 passed | [Log](./environment-gates/01-self-hosted-container.log) |
| `npm run build:hosted` | Exit 0; 3,693 unit + 39 portal unit + 21 portal acceptance + 1,219 integration + 189 hosted acceptance + 13 renderer cases passed | [Log](./environment-gates/02-build-hosted.log) |
| `npm run test:hosted-live` | 29/29 passed, including removal and changed signup/native MCP handoff; exit 0 | [Log](./environment-gates/03-workos-staging-live.log) |
| `npm run test:container:hosted` | Exit 0; 7/7 Linux AMD64 image cases passed; all inner build groups passed | [Log](./environment-gates/04-hosted-container.log) |
| Unit + integration coverage | 3,693 Node unit + 39 portal unit + 1,219 integration cases passed; 241 files, 813 processes | [Log](./coverage.log), [verified report](./coverage.json) |
| Habit-hooks and committed-candidate checker | Both exit 0; T0 locally eligible, no blockers; retained notes below | [Habit result](./habit-hooks-result.json), [checker](./checker.json) |

All passing test runs report zero failures, cancellations, skips, and todos. The ordinary suite covers the remaining check stages; no extra `npm run check` was run. Hosted builds retain their own required nested checks. No broader Members browser, separate Brave, SQL, Collector, or Render-interface group is selected because their behavior and drivers are unchanged.

Failure history: the first focused `tsx` run passed 15/16 but failed the JavaScript-on browser callback with `ReferenceError: __name is not defined`. Node's type transform passed the same checks without a source change. The raw first output was not saved; the linked notes label it as a transcription. Environment gates needed no retries. Process exit 1 is the retained existing-file MI goal miss, not a tool failure; Review, CRAP, and Architecture passed. The declaration probe ignored 33 diagnostics in two unlisted files; all 53 listed snapshots verified, and the separate full typecheck passed. [Probe log](./checker.log).

Coverage was captured with Node 24.20.0 and TypeScript 7.0.2 on base HEAD plus the frozen candidate changes. The final process verified compatibility with committed `3e5931a0` using source fingerprint `6f95b376598fec1c3d4555d95c595cfe88eef6daab9463849bc039f3aba145d1` and input fingerprint `950b427df258b8b37ec79fe2e46c755cae88a5e5c7d88b91a27854e271373a11`; the report was not edited or restamped. Raw captures remain local; the full normalized report and capture log are retained.

The native environment gates used the base plus the same frozen four-file overlay. The image gate ran in the primary checkout. [Overlay provenance](./environment-gates/candidate-provenance.json), [image provenance](./environment-gates/04-hosted-container-provenance.json), and [later documentation-only supplement](./environment-gates/documentation-supplement.json) retain exact identities. The automatic immutable base metric record adds no executable input.

Limits: clipboard success/denial uses browser stubs; native clipboard permission is not claimed. Local screenshots confirm the removed action and retained menu, and staging proves navigation through the real signup flow. Prior feature/release results do not substitute for this candidate. [Initial draft history](./publication-initial.json).
