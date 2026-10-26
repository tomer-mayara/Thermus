# Public policy publication proof

[Marketing PR 30](https://github.com/tomer-mayara/Thermus-Marketing/pull/30)
merged reviewed head `b07ea8836e3a8df1a8766af81846b25251915549` as
`9c35930d1d89d5560e331f1c8fc5bc2440c5c784` at 16:30:49 UTC on 26 October 2026.
The connector read the merged PR and exact head/merge identifiers.
[Validation](https://github.com/tomer-mayara/Thermus-Marketing/pull/30#issuecomment-6421375310)
and [Quality review](https://github.com/tomer-mayara/Thermus-Marketing/pull/30#issuecomment-6421375847)
retain its candidate review. [Earlier evidence](../README.md) is unchanged.

Netlify project `9753c4f4-c917-400e-9cd7-f638f81743a8` reports current production
deploy `6adf803c912d5fe402971f61`, ready on main, backing that exact merge commit.
It published at **2026-10-26T16:31:19.565Z**. The separate
[deployment record](netlify-deployment.json) contains selected safe connector
fields; no credentials or runtime configuration values were retained.
[Publication proof](publication-proof.json) ties the approved candidate, merge,
deploy, owner approval, and readback together.

## Complete public readback

[HTTP facts](http-readback.json) and the retained
[readback driver](http-readback.py) record all four public URL reads. Direct
`/terms` and `/privacy` return301 to their slash URLs; both final pages return200
HTML through Cloudflare. Slash/direct bodies are identical for each document.
Full source text, punctuation, all six Terms source links and thirteen Privacy
source links, all thirteen Privacy table rows/cells, source version/hash data,
effective date26 October, oneH1, local anchors, direct mailto, and footer links
pass. No unexpected link or Cloudflare email obfuscation was found.

The approved Terms source is20,941 bytes, SHA-256
`164e013e2cbf0889ad5aaaef14aac745acaed01023bc914c7adae1a4bf4ce048`.
Privacy is38,594 bytes, SHA-256
`df330cf3d905f4bd6f64d3a9dfd8dded5be476c39e40e05b87596e6678429b1c`.
Public URLs render HTML rather than raw Markdown. The comparison separately
checks source identity and normalized rendered content; it does not equate an
HTML hash with an approved Markdown hash. Complete delivered HTML hashes are recorded in the HTTP facts. Raw HTML
responses remain local and are excluded from this published evidence because
Cloudflare injected transient JWT-shaped data. No token values are included.
The complete policy DOM text and all content/metadata comparison results remain
available in the browser and HTTP records.

## Live presentation

[Browser readback](browser-readback.json) was collected through read-only
`cua_repl` control of Brave, without a direct Playwright/CDP browser process.
Both complete visible policy DOM texts match the approved source after renderer
normalization. At375 and1,280 pixels both pages have oneH1 and no horizontal
overflow. Inspected bounded screenshots show readable headers, removal text,
and the narrow retention table. The temporary viewport override was reset.

- [Mobile Terms](terms-live-375.png)
- [Desktop removal text](terms-live-1280-removal.png)
- [Desktop Privacy and date](privacy-live-1280.png)
- [Mobile retention section](privacy-live-375-retention.png)
- [Mobile removal-record retention table](privacy-live-375-removal-table.png)

Browser JavaScript settings and production access/security settings were not
changed. This is a live responsive browser observation, not a physical-device
or complete accessibility audit. No full tests were rerun for publication.
This proof establishes Marketing publication, not the separate Thermus runtime,
storage/capacity, or scoped deployed Slice2.5 journey.

[Artifact manifest](artifact-manifest.json) pins the added files.
[Secret-scan record](secret-scan.json) records the scan and its limits.
This additive evidence commit retains all earlier Marketing artifact blobs.
