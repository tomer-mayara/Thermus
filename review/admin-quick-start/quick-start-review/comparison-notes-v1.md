# Admin Quick start architecture comparison — draft v1

Supplementary C4 L3 view derived from the source and registry prose. Scope:
the hosted Thermus Node server. The browser application is a supporting L2
peer; WorkOS is the existing external service. Source owners remain components
inside the server. The guide and individual methods are not new components.

Comparison base: `feeaad4d5f04212f033366c232180be4bd40da4c`.
Candidate: the uncommitted implementation on
`d256c620c7dc8c6d928b9426d1819c293fcfa52c`; replace with the completed full
candidate SHA after commit. This draft cannot establish final-candidate review.

The amber owners have changed meaning and use explicit Changed labels. Every
relationship shown already exists and stays neutral. App's existing supplied
configuration now also carries the configured MCP URL. The new guide read uses
the existing web-to-workos session/access roles and web-to-organizations
`authorizeSelection` current-membership read. The registry's 20 diagrams remain
unchanged; only the relevant signup and navigation prose changes.

1. Before, confirmed activation and checked session selection returned to the
   portal root. After, signup returns to `quick-start`. Existing-access Continue,
   later login, and normal workspace selection keep their prior destinations.
   A failed selection cannot repeat the first-Admin grant.
2. The new `GET/HEAD quick-start` guide requires a selected session organization,
   matching current subject/authority and organization, product access, and the
   exact Admin role. The existing `authorizeSelection` read must return that
   organization's nonblank name. A query cannot choose its context. A failed or
   cancelled name read cannot produce a guide for a guessed workspace.
3. App supplies the trusted configured portal and MCP URLs through
   `HostedAccountRoutesOptions`. Web uses those URLs and the escaped trusted
   name for the complete guide and Markdown copy. The guide carries no secret,
   membership list, invitation link, or log record. Agent controls and customer
   enrollment remain outside this implementation.
4. `GET` returns the protected guide. `HEAD` keeps its status/headers and omits
   the body. Other methods return `405`. The copy status follows the actual
   clipboard write; failure shows selectable Markdown. Current Admin navigation
   puts Quick start before Connect; other users retain their current menu.

Omitted context: unchanged billing, Audit export, invitation/removal writes,
MCP authorization, signup activation internals, provider legal records, and
tenant processing. They retain their owners and existing relationships. Signup
uses its existing activation and selected-session contracts; the changed landing
does not add a provider operation or alter the lifetime/replay rule.

L4 omit rationale: the strongest changed production callable contract is the
new browser `GET/HEAD quick-start` response and its use after successful
creation. The review question is whether the current selected organization's
Admin authority and trusted configuration determine every displayed/copied
guide. The L3 owners and the access, name-read, method, failure, payload, and
redirect notes above answer that question. Another function-level drawing would
repeat those notes. Test-helper API changes do not require L4.

Render status: no supported local Mermaid renderer was found on PATH, in the
existing local npm/cache tooling, or in the bundled workspace dependencies.
No dependency was installed. Parser/render and normal-width inspection remain
pending. The manager must render and inspect near 800px before publication,
apply feedback in a new draft, and verify that embedded Mermaid matches the
retained source byte-for-byte. No registry Mermaid block needs a render because
none changed. Manager sign-off of this draft is pending.
