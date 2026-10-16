# Hosted User onboarding

This change implements the owner-approved operator-managed acceptance flow.
It adds no public policy page, agreement database, or implicit User grant.
The final procedure and private record templates are in progress in this draft
pull request.

## Acceptance scenarios

- Given no express acceptance for the actual verified identity and terms
  version, when an operator considers User access, the operator stops before
  the grant.
- Given a complete private acceptance record, when an operator grants User,
  the operator changes only User and records the verified result.
- Given a native MCP user, the same identity and acceptance checks apply
  without requiring a portal visit.
- Given an invitation that can grant User, the operator stops that path and
  uses identity verification followed by an explicit grant instead.
- Given an existing User without evidence, the operator records the gap and
  follows an explicit transition; sign-in is not backdated agreement.
- Given a deletion request, the operator verifies its scope and authority,
  removes only authorized access, and targets authorized deletion actions
  within 30 calendar days of receipt without extending legal deadlines.

These scenarios verify an operating procedure. They do not claim that the
application checks or stores agreement records.
