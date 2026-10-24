# S2-02b saved Audit destination Test

This ticket adds an optional Test action for a current Admin. The action uses
one saved destination revision and its saved credentials, including when export
is disabled. It sends one labelled synthetic event and changes no saved state.

The branch is based on PR #240. It also needs the destination settings and page
from PR #238. The new PR will include that dependency without changing #240.

## Acceptance and implementation order

Write failing acceptance cases for a disabled saved destination and an obsolete
Test result first. Then use focused failing tests for saved revision checks,
credential recovery, bounded admission, one sender attempt, cancellation, and
the post-settlement revision check. Add the protected web action and safe result
text, then verify browser, settings, and sender collaboration.

Test must reject unsaved edits, keep current Admin and tenant checks, and retain
origin and CSRF protection. It must suppress a result when the final saved
revision differs or cannot be read. A successful Test is not an Enable gate or
proof of continued delivery or durable storage.

## Review status

Implementation and complete-candidate checks are pending. This record makes no
claim about passing tests, CI, approval, merge, or release.
