# Native AMD64 image gate option

**Owner decision: keep the required image checks local. No Actions dispatch is authorized or planned.** The workflow/allowance option below is historical analysis, not a pending request or next action. Preserve the failed local attempts and obtain a complete local pass without weakening the gate.

The existing `.github/workflows/hosted-image.yml` runs on `ubuntu-latest`, builds
Dockerfile.hosted for linux/amd64 with its full offline checks, runs the seven
image cases against the same image, then pushes that image to GHCR. It does not
deploy. Its job timeout is 120 minutes. The owner requested required checks and
merge, but earlier required $0 new infrastructure costs.

The local Colima daemon reports aarch64, four CPUs and about 4 GB RAM. The current
build runs Node via `/mnt/lima-rosetta/rosetta`. Two runs have hit different
unchanged integration deadlines; the latest also required stopping its exact
stuck signal-test child to obtain diagnostics. These are failed gate attempts,
not evidence that the source is correct in the Linux image. No timeout or test
assertion was changed.

[GitHub included usage](https://docs.github.com/en/billing/reference/product-usage-included)
lists 2,000 Actions minutes for Free and warns that overage is charged unless
stopped by budget. [GitHub Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages)
says Container registry storage and bandwidth are currently free. These public
facts do not establish this account's remaining Actions allowance or budget.

Read-only `gh api user` reports login tomer-mayara and no plan value. Both legacy
Actions billing and current user usage-summary requests returned 404 with a
missing `user` scope notice. No scope refresh or billing change was attempted.
The temporary in-app browser was signed out; it was closed without sign-in or
settings changes. The earlier allowance question and workflow proposal are superseded by the owner’s decision to keep image checks local. No Actions workflow has been dispatched. A complete passing local result is still required; retain exact inputs, tested image digest and all failed-attempt history.
