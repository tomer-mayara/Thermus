# Fresh AMD64 gate: first attempt failed

Base21458b0d18cc4f9efd3a59f6361a86f1acdc317c plus the exact original frozen source/guide overlay. No previous pass result was reused.

Command: npm run test:container:hosted. Exit1; outer tests1,pass0,fail1,cancelled0,skipped0,todo0. Duration819763.428458ms.

The image failed at Dockerfile.hosted:52, its unchanged offline build:hosted stage. Unit3693,portalunit39 and portalacceptance21 passed. Integration had1218pass/1fail/0cancel/0skip/0todo. Hosted acceptance, renderer and final image runtime proofs were not reached; no final image pass is claimed.

Failure: workos-provider-verification.test.ts:233-236, the refused-loopback AuthKit JWKS case. The expected error name was TypeError; actual was JWKSTimeout. It uses unchanged timeoutDuration100ms. Case elapsed431.857417ms. The port helper listens on an ephemeral loopback port, closes it, then returns it. This narrow timer-vs-transport error race is consistent with the slow emulated/shared-host run; both errors remain unexpected key-set errors rather than an invalid-token result. This is an inference, not a reproduced root-cause proof. Copy-only source changes do not touch that behavior.

Original provenance, full sanitized failure/build logs, exact assertion output and source/guide hashes are retained. No source, Dockerfile, assertion, deadline or environment setting was changed; no retry has run. Frozen source and guide still match primary. Test-owned gate labelb93d1b3a5a21 has no remaining containers. Await manager direction on an unchanged retry; do not treat this run as successful validation.
