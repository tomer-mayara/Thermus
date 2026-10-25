# S2.5-01c architecture assessment draft

Parent: `0ff3f6cdde5be4124df0ed2ab002844d5db1c502` (actual PR253 parent).
Candidate: working tree; final source and head pin pending implementation.

The parent has 15 Mermaid views. `inventory-parent.json` records heading, parent line and exact source SHA-256 for every block. `registry-parent.md` preserves the parent registry. The focused hosted membership-removal component view is affected. Adjacent hosted authentication, Audit settings/delivery, system/audit logging, hosted member-read scenario, collaboration, ownership, resource ownership, and deployment views must be checked against the final source. The proposed caller stays in web. It does not create a source owner, container or deployment.

Parent behavior from source: HostedAccountRoutes authenticates first, then resolves current access and requires trusted tenantId before administration dispatch. Identity-only organization selection runs before tenant dispatch. AdministrationRoutes has no removal route. OrganizationAdministration.removeMember already owns the existing checked coordinator and durable store. AuditLog.AdministrationChange and its projection accept invitation actions only. The new route must use trusted tenant context for capture and must not give the form authority to choose an export tenant.

The main comparison should show existing organizations, audit-logs and workos owners as unchanged; show web responsibility amber and its new checked removal runtime use green. The store/runtime relationships stay neutral. Distinguish the newly used web→organizations operation from the existing owner edge. Show trusted browser/access and native form gates in web; current Admin/target/last-Admin and durable rules remain in organizations. Capture is an independent best-effort result, with no authority to settle the durable operation.

L4 decision pending final source. The strongest expected contract change is customer AdministrationChange removal metadata/outcomes. A single L3 web→audit-logs call plus behavior notes can explain tenant authority, payload and non-replay rules; no L4 is expected unless final code adds a more complex caller-visible contract.

No live deployment or infrastructure evidence is claimed. Registry comparison and source evidence are local.
