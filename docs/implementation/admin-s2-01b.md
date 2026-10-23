# S2-01b implementation record

This ticket adds the current Admin's Logging settings page and atomic Save to
the storage contract from S2-01a. The pull request is stacked on #237.

## Scope

- Read and save one destination for the current organization.
- Encrypt the optional Bearer token with the server key and tenant binding.
- Preserve the revision and ciphertext when settings do not change.
- Reject stale forms and show uncertain writes without an automatic retry.
- Keep current password, Admin, origin, CSRF, and tenant checks.

This ticket sends no Collector request and adds no MFA requirement. Live
Supabase setup and rollout checks remain in S2-04.

## Behavior and ownership

Logging owns validation, tenant-bound encryption, the public read projection, and
semantic no-op decisions. The PostgreSQL store remains the revision authority.
Web obtains the tenant and current Admin permission from trusted browser context,
then checks origin and CSRF for Save. The page never receives the saved token.

A blank Bearer token retains the saved token only for unchanged endpoint/auth.
None clears it. Re-entering the same token preserves its ciphertext. A stale
revision returns conflict. The native unconfirmed response offers only a GET
saved-state link, with no Save form or automatic retry. It adds no server-wide
or session write hold. Every later Save, including a manual old-form submission,
and every late commit still faces the store's atomic expected-revision check.

The app supplies the optional service and server key and owns SQL runtime cleanup.
The key and SQL connection settings remain server configuration. Endpoint checks
here cover syntax and literal addresses; actual-connection egress checks belong
to the sender ticket. No Collector request or WorkOS catalog change is added.

## Architecture impact

The existing hosted Node server and PostgreSQL containers remain. Web gains a
runtime read/Save collaboration with logging through the supplied service. The
Logging browser/server contract and tenant-bound credential handling require
T2 Need architect. The registry updates its hosted settings component view,
collaboration overview, and source-owner description. An agent review does not
supply the required independent human architect approval.

## Verification

The first browser acceptance failed because an authenticated Admin received 404
for Logging. Destination and web unit tests then failed on the missing source
modules. Small red/green steps added validation, tenant-bound credentials, safe
read/Save outcomes, and the native form. Regression tests caught malformed IPv6
literals, empty URL userinfo, private exception text, and late commit races.

The compiled focused selection passes 86 tests. The changed portal unit and
acceptance files pass 40 tests. Typecheck passes. The first ordinary suite found
one obsolete assertion that Logging navigation must be absent. That assertion
and its portal counterpart now require Admin Logging navigation while retaining
checks that deferred controls stay absent. Their focused tests pass. Complete
candidate gates are still in progress.

Source changes select `npm test`, typecheck, portal build, self-hosted container,
hosted offline build, Linux AMD64 hosted image, and local PostgreSQL gates.
Hosted-live is not selected: no hosted authentication or WorkOS organization
read/change implementation changes. The existing current-access resolver is
reused and exercised by the new offline HTTP acceptance. No live Supabase
rollout or actual Collector egress is claimed.

## Maintainability review

The first source snapshot and focused file inspections show six new files below
MI 85. Their guards and cryptographic operations remain in cohesive owners.
The IPv4 checks use a range table, and the form reuses the existing CSRF and
exact-field parser. Further splits would spread these small invariants.
Time-limited exceptions record each new file's measured floor and reason; the
small hosted composition exception also covers service/key wiring. Full CRAP,
habit-hooks, review-tier and final snapshot evidence remains pending.
