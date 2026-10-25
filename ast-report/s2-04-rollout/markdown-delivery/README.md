# Markdown delivery verification — 24 October 2026

The remaining public Markdown readback is complete. The live Audit guide and
complete guide display in normal Brave navigation and match their full source
content. No site delivery or security change was needed.

The product release remains Thermus `a7411fd02aa6dd3300b334d4585f71469071b499`.
The verified Marketing deployment is `6add6e411d03bbad9772d021`, from main
`f0092febe3443b411e817b721fcb96928a3a4bd1`.
[Marketing PR #29](https://github.com/tomer-mayara/Thermus-Marketing/pull/29)
adds verifier and documentation fixes only. Its candidate is
`1e1c73ade29f8dce1e0a61ea062f598216bad6bf`.

## Findings

| Check | Result |
| --- | --- |
| Default Python client | Cloudflare 403 / 1010 on HTML, robots.txt, Privacy, and Markdown. |
| Descriptive verification client | 200 for complete guide, Audit guide, and negotiated Markdown homepage. |
| Controlled Brave tab | ERR_BLOCKED_BY_CLIENT for Markdown, including an isolated local probe. |
| Normal Brave navigation | Both live guides opened. The complete-guide test used the actual homepage link. |
| Full displayed content | Exact equality: Audit guide 5,149 bytes; complete guide 45,826 bytes. |
| Netlify request record | The controlled browser's complete-guide request reached Netlify and returned 200. |

The controlled-session failure does not establish a Brave-wide or MIME-type
defect. Its exact internal mechanism remains unproved. A proposed MIME/header
or HTML-view site change was discarded after normal navigation succeeded.
The Cloudflare result is client-dependent; no Cloudflare rule or browser
protection was disabled. The verifier uses its own name, not a browser identity.
The guide checker retains separately marked synthetic provider profiles; these
do not prove access from a provider's real network.

## Fix and review

The discovery script now identifies itself on every request. The guide script
also checks the complete guide's GET body, HEAD response, and public CORS.
Markdown and API requests reject redirects. HTML catalog links can follow
canonical redirects and must finish on the checked origin.

Syntax and diff checks passed. The guide check passed all 22 requests. The first
discovery run rejected the existing `/contact-us` to `/contact-us/` redirect;
the final run passed after restoring canonical HTML redirect handling. The
failed observation is retained in the diagnostic and review record.
Independent reviewer `rollout_gate_review` found no blockers. The manager
review accepted the complete candidate. No product source, legal text,
deployment configuration, credentials, infrastructure, or security settings
changed. Script and document scope needs syntax and manual checks, not new
script tests or production metrics.

## Evidence

- [Native Audit content check](native-audit-guide.json)
- [Native complete-guide content check](native-complete-guide.json)
- [Default-client baseline](http-baseline.json)
- [Identified-client comparison](identified-client.json)
- [Netlify request proof](netlify-request-proof.json)
- [Guide delivery checks](guide-access.json)
- [Successful discovery check](discovery-2.log)
- [HTML redirect diagnostic](redirect-diagnostic.json)
- [Implementation review and retry history](review.json)
- [Manager and independent review](manager-review.json)

These results supersede only the direct-Markdown limitation in the prior
[rollout record](../postmerge/README.md). That record and its earlier observations
remain unchanged. Existing Audit receipts, MCP result parity, settings restart
proof, legal publication checks, and Render auto-deploy evidence still apply.
