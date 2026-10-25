# S2.5-02 controlled integrated proof

Candidate files:
- test/acceptance/auth/hosted-member-removal-integrated.runtime.ts
- test/acceptance/auth/fixtures/member-removal-integrated-site.ts

Selected runtime group: private PostgreSQL. Focused command after the coordinated build:

    node --test --test-concurrency=1 dist/test/acceptance/auth/hosted-member-removal-integrated.runtime.js

The fixture has no consumers outside this runtime file. No ordinary suite, global build, or test was run by the worker before the manager coordinates dist and ports.

The test subject is production code under src/: hosted composition, browser routes, WorkOS adapter, member-removal coordinator, PostgreSQL store, Audit snapshots and Collector, MCP authorization, and the product fetch pipeline. There are no tests of scripts or documents.

The composition uses a real loopback HTTP listener and disposable PostgreSQL 17 with verified TLS and the scoped runtime role. WorkOS exchanges, directory data, and personal-factor sentinels are controlled. Each journey starts with password authentication and two Admins plus one ordinary User. The sentinels prove controlled adapter scope; they do not prove a live provider guarantee or MFA feasibility.

The enabled-export case uses the production SQL-backed settings, snapshot, queue, and per-attempt export authorization. Its external sender returns a controlled permanent transport failure at the existing sender seam. It proves export failure does not change the completed removal or replay its provider delete. It does not prove network, TLS, or real Collector behavior. The existing real Collector gate remains separate.

The outage case stops the disposable PostgreSQL container before a valid HTTP removal POST. Portal access and an MCP getURLAsMarkdown call still run. The fetch pipeline is real; its renderer process is controlled. No cloud resource is changed.

The store retains the latest operation for each organization, rather than an append-only event history. The last-Admin refusal writes a new no-effect receipt after the test checks the successful self-removal receipt.
