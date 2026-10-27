# Production workspace picker verification

The approved commit `feaddbdec5f9e2cc7bf8e07050a4d5e7aa5e5769` is live at
https://app.thermus.ai/. Render deploy `dep-dbgidiou01pc73c6h7ag` started at
2026-10-27 22:33:47 UTC and became live at 22:39:16 UTC. The public health
endpoint returned HTTP 200 and `ok`. The new instance is
`srv-db8mnqg473hc739d529g-pppkv`; its warning/error query returned no entries
from startup through 22:45:18 UTC.

The manager clicked the actual `Thermus AI (selected)` organization button in
both existing production sessions. Both left `/organizations` and opened `/`,
where Connect showed the selected Thermus AI workspace. The Details text
confirmed `Roles: user` for the non-admin and `Roles: admin` for the admin.

The User account had only Connect and Switch Workspace on both pages. After
reopening the picker, Thermus AI remained selected and the basic menu remained.
Its Connect link also returned to the product page. The Admin account had
Connect, Switch Workspace, Members, and Audit Log in that order. Members and
Audit Log opened their pages and retained the same compact menu. Both sessions
were returned to Connect. No membership, role, invitation, destination,
credential, or environment setting was changed.

`verification.json` records exact observations, deploy metadata, health and log
query results. `admin-picker.jpg` and `user-picker.jpg` show the production
menus; the manager visually inspected both. The production accounts have one
workspace. Different-workspace selection, narrow/wide layouts, keyboard use,
and JavaScript on/off have separate automated evidence.

The owner explicitly approved feaddbde and its production deployment. A later
upstream release-tooling merge prevented PR281 from merging at that head, but
Render supports an exact commit from any branch. The unchanged approved release
was deployed while the updated PR refreshed its checks. This release report
does not claim deployment or approval of the later PR head44753a72, and does
not claim that PR281 has merged. Production retains its documented Git-based
manual deployment mode; the future SO-12 image migration was not performed.
