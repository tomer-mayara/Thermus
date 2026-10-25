# Applied architecture review v4

Base: `122d65bf1f035fc195792cc083732aa05c423c58` (actual stacked parent).
Head: working draft; final committed SHA refresh remains with the manager.
Only `architecture/components.md` was changed outside this task's cache folder.
No Git mutation, PR mutation, dependency installation, source edit, or broad test
run was performed by this reviewer.

The final provider/coordinator source was read after the stop-signal fix.
The registry now records server-owned cancellation of later directory reads,
fixed 30-second removal lifetime, ten-page active-member limit, initial and
post-admission authorization, last-Admin refusal, durable per-org admission,
exact-operation terminal receipts/readback, same-pool ownership, shutdown order,
and late final-write limits. Browser removal and customer capture remain unwired.
No MFA policy, component, process, datastore container, or source owner edge is
added. Read signals extend the existing directory contract. Runtime store calls
point from organizations to audit-logs; the implementation's source type import
points in the other direction on an already declared owner pair.

## Registry changes and simplification

The registry has 15 Mermaid views, compared with 13 at the parent. Eight original
blocks remain byte-for-byte unchanged. Four original blocks were updated in
place: hosted containers, hosted authentication, Audit storage, and collaboration.
The original combined deployment block was replaced with separate local and
hosted deployment views; the focused membership-removal view is new. The split
keeps the two deployment alternatives readable without changing topology.

The initial broad renders shrank text to 4.4–8.5px at 800px and were not approved.
The first added overview relationship crossed an unrelated tool box. The final
revision uses shorter labels, narrower wrapping, and reordered edges. The crossing
is removed. Two commented invisible links in the hosted container/deployment
sources constrain layout only; they are not runtime relationships. The container
HTTP arrow now summarizes both account requests and asset service, which the
adjacent prose states. Exact role names remain in the authentication prose.
Unchanged loopback publishing, file mount paths, and Render ingress were moved
from the deployment drawings into adjacent prose to clear the Docker titles.
All process, Docker, datastore, external-service, and local/hosted distinctions
remain shown. Trial and original source/render versions are retained in this folder.
A top subgraph title margin obscured a nested title in an intermediate render;
the final top margin is zero and the bottom margin adds clear space before nodes.

The main comparison remains `comparison-v2.mmd`. Its four internal components
and two external peers are readable and need no L4 drawing. The adjacent notes
in `proposal-v2.md` preserve admission, authority, outcome/readback, and lifetime
rules. The concrete stop-propagation review question is answered at the WorkOS
owner with its optional read signal; private phase helpers are not diagram nodes.

## Validation

All seven final registry sources were extracted from the actual embedded blocks
and matched their standalone source files byte-for-byte before rendering.
All eight selected diagrams parsed and rendered offline. All local Markdown file
links in the registry resolve. Rendering used Mermaid 11.16.0, Playwright
1.62.0, and Chromium 156.0.8078.4 at 800 × 1000 viewport with
DPR 1 and neutral label backgrounds. No network requests were needed. The asset
path and SHA-256, browser path, source hashes, SVG/PNG hashes, source line bounds,
and dimensions are in `renders-applied-v4/render-report-v2.json`.

| Diagram | PNG dimensions | Approximate text at 800px | PNG and SVG |
| --- | --- | --- | --- |
| comparison-v2 | 800 × 819 | 16.3px | `renders-applied-v4/comparison-v2-800.png` / `.svg` |
| registry-hosted-containers-v2 | 800 × 1020 | 14.5px | `renders-applied-v4/registry-hosted-containers-v2-800.png` / `.svg` |
| registry-hosted-auth-v2 | 800 × 709 | 12.7px | `renders-applied-v4/registry-hosted-auth-v2-800.png` / `.svg` |
| registry-membership-removal-v2 | 800 × 851 | 16.4px | `renders-applied-v4/registry-membership-removal-v2-800.png` / `.svg` |
| registry-audit-storage-v1 | 800 × 908 | 15.9px | `renders-applied-v4/registry-audit-storage-v1-800.png` / `.svg` |
| registry-collaboration-v3 | 800 × 664 | 12.1px | `renders-applied-v4/registry-collaboration-v3-800.png` / `.svg` |
| registry-deployment-local-v4 | 800 × 672 | 20.4px | `renders-applied-v4/registry-deployment-local-v4-800.png` / `.svg` |
| registry-deployment-hosted-v4 | 800 × 814 | 16.7px | `renders-applied-v4/registry-deployment-hosted-v4-800.png` / `.svg` |

All final views were inspected at 800px for label readability, title clearance,
boundaries, arrow targets, and crossings. The comparison and changed registry
views have no observed label/box crossing after these fixes. This is delegated
review evidence, not independent human approval or the manager's sign-off.
Manager review is pending for every final render.

`inventory-applied-v4.json` pins the parent, working-source SHA-256 hashes, all
15 registry blocks, and changed-view inventory. `registry-applied-v4.diff` retains
the parent-to-working registry change. Final parent/head SHA links, complete
candidate validation, checker facts, tier, and approval must be refreshed by the
manager before publication. The original v1/v2 proposals remain historical drafts;
use this applied record and v4 inventory for the final registry state.
