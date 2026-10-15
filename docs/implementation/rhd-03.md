# RHD-03 — Checked hosted Docker image

Status: in progress. This change stacks on PR #116, the RHD-02 hosted portal
and startup checks.

## Scope

Add a separate hosted image with the production portal, native cleaner,
pinned renderer, CA bundle, and versioned trusted ad rules. Keep the
self-hosted image contract. The final hosted target must depend on successful
offline checks, without live credentials or a Docker daemon in the build.

Prove the assembled Linux AMD64 image through its public interfaces. Cover
HTTPS and JavaScript rendering, private-network refusal, overload,
cancellation, bounded shutdown, invalid startup, and a failed offline build
gate. Run the required local, self-hosted container, and hosted live gates.

The [deployment plan](render-hosted-docker-plan.md#rhd-03--build-and-prove-the-hosted-image)
defines the acceptance criteria. Render service setup stays in RHD-04.

## Verification

Pending. Record red-first evidence, exact commands, results, image platform,
and review decisions here before the pull request is ready.
