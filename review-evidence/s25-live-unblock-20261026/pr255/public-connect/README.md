# Live command result

Candidate `1a3e5a6638d71e03485e0280848ee5e025335382`; actual merge base `ddad19589a13e40b1aea516b2e5e3b90ea3aec70`; current main `e61da534d428169936e80f2bdaebe081c902aee0`.

Command: `/Users/tomermayara/.nvm/versions/node/v24.20.0/bin/node /Users/tomermayara/.config/thermus/with-workos-staging.cjs /Users/tomermayara/.nvm/versions/node/v24.20.0/bin/node --test --test-concurrency=1 dist/test/acceptance/auth/fetch-public-connect.live.js dist/test/acceptance/auth/fetch-public-script.live.js`

UTC 2026-10-26T13:44:14.374759+00:00 to 2026-10-26T13:44:47.280386+00:00; process exit 0. Original totals: tests=2, suites=0, pass=2, fail=0, cancelled=0, skipped=0, todo=0.

Accepted gate pass: True. Guard active in fetch-public-connect.live.js, fetch-public-script.live.js; delete-denied=0; allowed delete callthroughs=5.

Only original static test/suite status/title/duration lines and aggregate summary retained. All other stream lines, provider content, resource IDs, actor addresses and runtime diagnostics omitted. Private originals retained at mode0600.

Original live runner parsed only TAP # summary lines. This independent receipt also reads Node spec ℹ summary lines. It changes no command, outcome or original artifact.

- passed: Given a Staging first-party Public Connect client and an owned user, when browser PKCE reaches the real loopback callback and refreshes, then the MCP backend accepts its resource-bound workspace grant
- passed: Given a first-party Public Staging client, when the actual fetch script logs in, reuses and refreshes its grant, then real rendered fetch works and logout removes only local credentials

Private raw log SHA256: `b8071c8a63512abef88122938f8b11dfc3a15f931f86c7744505f68e9ffac835`. Private exact-ID journal SHA256: `52d7c879604e6f9a7dc49eb420823540d7ab68e39e4cabbf434f2884d4c7c0b5`.
