## habit-hooks review

`pnpm exec habit-hooks --branch origin/main` completed with exit 1: 55 comment findings and 4 file-size findings. No unused-variable or boundary-rule finding remains. The snooze file is `[]`.

The manager reviewed each finding and keeps it for the reasons below, as AGENTS.md permits. No lint rule or threshold was relaxed.

- `.habit-hooks/eslint.config.mjs` (comments at lines 63): The comment ties the standalone container script list to layout rule D6. The rule file remains one coherent lint configuration, and shrinks from 218 to 217 lines.
- `test/acceptance/auth/hosted-image.test.ts` (comments at lines 19): The comment states the AMD64 and credential preconditions of the explicit gate.
- `test/acceptance/auth/hosted.live.ts` (comments at lines 15, 41, 73, 91, 92): The comments state credential-redaction and setup-failure constraints, plus the suite order that shares the real token-expiry wait.
- `test/acceptance/auth/self-hosted-container.test.ts` (comments at lines 24, 27, 28, 54, 90, 153): The comments explain gate isolation, excluded hosted capabilities, test-only network seams, and why an address literal avoids outbound DNS. Its 506 lines keep deployment scenarios and their one gate lifecycle together; it shrinks from 642 lines.
- `test/integration/auth/hosted-live-site.test.ts` (comments at lines 13): The comment states why placeholder credentials cannot reach a WorkOS environment at startup.
- `test/support/container/container-gate.ts` (comments at lines 9, 13, 20): The comments explain the operator mount, resource labels used by failure cleanup, and the same-content image used to model an update.
- `test/support/container/container-probe.ts` (comments at lines 1): The comment identifies the separate container execution context of the probe.
- `test/support/container/hosted-image-gate.ts` (comments at lines 13, 14): The comments explain why mounted support must retain relative access to compiled src inside the image.
- `test/support/hosted-live/browser-session.ts` (comments at lines 31, 62): The comments distinguish the sealed session from the browser callback that the fixture intercepts.
- `test/support/hosted-live/connect-client.ts` (comments at lines 46): The comment names the public PKCE/MCP resource contract modeled by the client.
- `test/support/hosted-live/settings.ts` (comments at lines 22): The comment explains why live failures use no retry and a short timeout.
- `test/support/processes/module-paths.ts` (comments at lines 3, 4, 5, 6, 18, 21, 24, 25, 30, 33, 43, 44, 50, 53): The comments explain source-versus-emitted paths, URL-versus-path uses, generated portal and renderer inputs, container mounts, and preloads that the compiler cannot check.
- `test/acceptance/auth/hosted-live/administration-proofs.ts` (comments at lines 28, 45, 68, 69, 80, 96, 122, 135, 153, 189): The comments identify staging read/write boundaries, page-size instrumentation, state and revision comparisons, and fixture invariants. Its 290 lines share one directory-service lifecycle and shrink from 357 lines.
- `test/acceptance/auth/hosted-live/hosted-server.ts` (comments at lines 21, 88, 107, 163, 198, 228): The comments explain token expiry and revocation timing, independent fresh grants, and navigation-sensitive logout assertions. Its 234 lines keep the hosted credential lifecycle together; only stale comments changed in this file.
- `test/acceptance/auth/hosted-live/operator-setup.ts` (comments at lines 22): The comment identifies the application service reads against staging, distinct from fixture setup.
