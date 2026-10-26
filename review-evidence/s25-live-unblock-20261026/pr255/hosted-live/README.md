# Live command result

Candidate `1a3e5a6638d71e03485e0280848ee5e025335382`; actual merge base `ddad19589a13e40b1aea516b2e5e3b90ea3aec70`; current main `e61da534d428169936e80f2bdaebe081c902aee0`.

Command: `/Users/tomermayara/.nvm/versions/node/v24.20.0/bin/node /Users/tomermayara/.config/thermus/with-workos-staging.cjs npm run test:hosted-live`

UTC 2026-10-26T13:32:08.119556+00:00 to 2026-10-26T13:43:00.907640+00:00; process exit 0. Original totals: tests=29, suites=8, pass=29, fail=0, cancelled=0, skipped=0, todo=0.

Accepted gate pass: True. Guard active in hosted-removal.live.js, hosted.live.js; delete-denied=0; allowed delete callthroughs=48.

Only original static test/suite status/title/duration lines and aggregate summary retained. All other stream lines, provider content, resource IDs, actor addresses and runtime diagnostics omitted. Private originals retained at mode0600.

Original live runner parsed only TAP # summary lines. This independent receipt also reads Node spec ℹ summary lines. It changes no command, outcome or original artifact.

- passed: Given fresh password-only WorkOS fixtures and disposable Slice 2 SQL with two Admins and a User, when Members refuses unsafe requests, removes the User and the acting Admin, then exact memberships disappear, portal and MCP access stop, other access and both accounts remain, selection works, the last Admin is protected, and a fresh invitation restores only its new role
- passed: Given a verified identity without a membership, when the operator grants Admin, then WorkOS has exactly the role admin with product and administration permissions, and a second grant changes nothing
- passed: Given an identity with User in two organizations, when the operator grants and then revokes Admin in one organization, then User stays at each step, and the identity and the other membership do not change
- passed: Given a membership whose only grant is Admin, when the operator revokes it, then the membership stays active with only the default role, which gives no application permission: the organization service lists no organization for the identity, and the identity stays
- passed: Given an Admin that also has User, when the operator replaces it with another verified identity, then the new identity gets Admin first, so that the organization keeps an Admin at each step, and the old identity loses only Admin and keeps User
- passed: Given an Admin whose membership is inactive, when the operator recovers access, then the grant for the inactive membership stops without a create or a reactivation, and another verified identity gets Admin
- passed: Hosted live proofs (AUTH-07W): external operator setup and recovery with the pinned SDK
- passed: Given memberships of D in the statuses active, inactive, and pending, when the directory reads them in pages of two, then each status filter gives exactly the memberships of a direct WorkOS read with that filter, and the product member count counts each active User or Admin once; the default role, pending, and inactive count zero
- passed: Given an identity without a membership in D, when the directory invites it as Admin, sends again to its address and to an active member, resends, revokes, and then resends and revokes again, then the send gives a pending Admin invitation and a pending membership with only admin; both other sends are address-in-use without a second invitation; the resend and the revoke are applied; the revoked invitation is listed only as revoked and its membership stays pending without access; the last two changes are not-pending; and no result holds the token or the link of the invitation
- passed: Hosted live proofs (AUTH-08W): member reads, product member count, and invitations of the directory against WorkOS
- passed: Given users without an authorized active organization in WorkOS — only an inactive membership, or only the default role —, when each signs in and opens the organization page, then each gets the invitation and operator guidance without a form, and the billing page and the protected portal request refuse each of them
- passed: Given a member with User and Admin in A, User in B, and an inactive membership in the operator organization, when it opens the organization page and selects B for the portal, then only A and B are offered with their WorkOS names, the 303 sets a new session cookie, and the session and the portal are in B
- passed: Given the same member in B, when it posts a selection of an organization without its membership, of its inactive membership, from another origin, or with another form token, then each gets 403 and no switch: the session stays in B
- passed: Given an operator-created Admin, when it signs in with a password, then its organization is offered and billing and product access work while the retired grant route is unavailable; after operator revocation the same session loses its organization access
- passed: Hosted live gate (AUTH-07W): organization onboarding and selection at https://localhost:46443/ with WorkOS
- passed: Given a password-signed-in Admin and a valid current grant form, when it opens administration and product access and posts to the retired grant route, then the reads succeed and the post gets 404 with no grant controls, provider change, or grant record
- passed: Hosted live gate (AUTH-08W): retired grant route
- passed: Given the administrator of C, when it invites an identity without a membership as User and an identity whose inactive membership had User and Admin as Admin, repeats the User invitation, invites the pending address as Admin and an active member, resends the User invitation, and sends and revokes a third invitation, then the sends, the repeat, the resend, and the revoke get 303, the other two sends get 409 address in use, WorkOS has one invitation to each address and the pending membership of the Admin invitation has only admin, Members shows only pending invitations with current actions, each change has its record, and no page or log line holds an invitation token or link
- passed: Given a User in C and a pending invitation, when the User opens administration and submits valid send, resend, and revoke forms, then each request is refused without a form and WorkOS memberships and invitations stay unchanged
- passed: Given the pending User invitation and the pending Admin invitation of C, when each invitee opens its invitation link and completes password sign-in without MFA, then WorkOS gives only the invited role and both can open the product; only Admin opens administration, the earlier User grant does not return, both invitations are accepted, the product member count matches WorkOS, and no page or log holds an invitation token or link
- passed: Hosted live gate (AUTH-08W): invitations of organization C at https://localhost:46443/ with WorkOS and AuthKit
- passed: Given a member with User and Admin in organization A, when the member signs in with a password and chooses A, then no MFA is demanded, the sealed cookie is HttpOnly, Secure, and SameSite=Lax, the session has no MFA evidence, and the portal shows current product access in A
- passed: Given a signed-in user without an active membership, when the portal and the organization page open, then the portal shows no product access, the protected portal request gives 403, and the organization page gives the onboarding guidance
- passed: Given an Admin-only member and a default-role member of organization A, when each signs in, then Admin has product access and the default role is refused
- passed: Given the Connect grant of a User in organization A, when its MCP client calls the MCP endpoint, then the call succeeds; without a token the answer is 401 with a Bearer challenge that names the protected-resource metadata, which names the AuthKit issuer
- passed: Given a browser access token and an M2M token, when each is sent to the MCP endpoint, then each gets 401 and no MCP work
- passed: Given a member with Admin only in organization A and User in organization B, when the browser session is in A and the MCP grant is in B, then each opens in its own organization; deactivating the A membership closes portal access while MCP in B still works
- passed: Given an Admin-only member of organization A with a Connect grant, when its MCP client calls the MCP endpoint, then it succeeds because Admin includes product access
- passed: Given an external sign-in, when a browser opens the AuthKit domain directly, then AuthKit sends it to the Initiate login URI /login of the server, which starts the sign-in, and the user ends signed in on the portal
- passed: Given the signed-in portal, when the member clicks Sign Out, then the server clears the session cookie and sends the browser to the WorkOS logout URL, WorkOS ends the session, and the browser lands on the Sign-out URI, which shows the signed-out portal
- passed: Given a signed-in session, an ended session, and an MCP grant whose consent was revoked, when their 300-second access tokens expire, then the session refreshes with a new cookie and the same form token, the ended session gives 401 with a cleared cookie, and the revoked grant works until its token expires and then gives 401
- passed: Hosted live gate (AUTH-06): the hosted server at https://localhost:46443/ with WorkOS
- passed: Given the selection session in B after its access token expired, when it posts a refused selection, then the 403 carries the refreshed session cookie, the form token stays the same, and the session stays in B
- passed: Hosted live gate (AUTH-07W): a selection after the access token of the session expired
- passed: Given a verified new Staging user without memberships, when the user names Acme Labs and accepts the unchecked test authority agreement, then the saved record has ten exact fields, access is Admin, and a real MCP client fetches a public page with a token for that organization
- passed: Given an activated user with a second User workspace, when the browser selects B while an MCP token stays in A, then revoking A denies that same token and repeat activation cannot restore A, while browser B and a fresh B token still work
- passed: Hosted live gate: organization creation and native MCP handoff

Private raw log SHA256: `007f6f5ffa3e8ebe2a6899e299b213f4b1df52843724b9590c1387e57af0cb01`. Private exact-ID journal SHA256: `8608cf07db41baf50933d0f31738aad9d431be145e5ce0a856c31e9e892b7846`.
