## CRAP goals

Goals: CRAP < 30; new functions also CRAP ≤ 15.

| File | Function | Change | Paths | Coverage | CRAP | To do |
| --- | --- | --- | --- | --- | --- | --- |
| src/logs/audit/otlp-audit-encoding.ts | eventAttributes | changed | 16 | 100% | 16.0 | ok; for 15: split |
| src/logs/audit/audit-event-projection.ts | inputOf | unchanged | 13 | 91.5% | 13.1 | ok; unchanged by this PR |
| src/logs/audit/audit-event-projection.ts | administrationTarget | new | 11 | 96.7% | 11.0 | ok |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.changeOnPost | unchanged | 11 | 100% | 11.0 | ok; unchanged by this PR |
| src/logs/audit/audit-event-projection.ts | contextOf | unchanged | 9 | 97.9% | 9.0 | ok; unchanged by this PR |
| src/logs/audit/audit-event-projection.ts | projectToolCompletion | unchanged | 9 | 98.9% | 9.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | checkRemoval | unchanged | 9 | 100% | 9.0 | ok; unchanged by this PR |
| src/logs/audit/audit-event-projection.ts | projectAdministrationChange | changed | 8 | 97% | 8.0 | ok |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.keep | changed | 7 | 100% | 7.0 | ok |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.removeMember | new | 7 | 100% | 7.0 | ok |
| src/interfaces/web/account/account-form.ts | account-form\ReturnDestinations.check | unchanged | 6 | 100% | 6.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-form.ts | invitationIn | unchanged | 6 | 100% | 6.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.organizationPage | unchanged | 6 | 100% | 6.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.selectOrganization | unchanged | 6 | 100% | 6.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-form.ts | readForm | unchanged | 5 | 94.6% | 5.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | targetRefusal | changed | 5 | 100% | 5.0 | ok |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.tenantOperation | unchanged | 5 | 100% | 5.0 | ok; unchanged by this PR |
| src/logs/audit/audit-event-projection.ts | inputText | unchanged | 5 | 100% | 5.0 | ok; unchanged by this PR |
| src/logs/audit/otlp-audit-encoding.ts | encodeAuditEvent | unchanged | 5 | 100% | 5.0 | ok; unchanged by this PR |
| src/logs/audit/otlp-audit-encoding.ts | timestampNanos | unchanged | 5 | 100% | 5.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 4 | 100% | 4.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | removalSupported | new | 4 | 100% | 4.0 | ok |
| src/interfaces/web/account/account-form.ts | formFields | unchanged | 4 | 100% | 4.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-form.ts | invitationChangeIn | unchanged | 4 | 100% | 4.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-form.ts | isSessionToken | unchanged | 4 | 100% | 4.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-form.ts | selectionIn | unchanged | 4 | 100% | 4.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | deepFreeze | unchanged | 4 | 100% | 4.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.page | unchanged | 4 | 100% | 4.0 | ok; unchanged by this PR |
| src/logs/audit/audit-event-projection.ts | metadata | unchanged | 4 | 100% | 4.0 | ok; unchanged by this PR |
| src/logs/audit/audit-event-projection.ts | projectDestinationChange | unchanged | 4 | 100% | 4.0 | ok; unchanged by this PR |
| src/logs/audit/otlp-audit-encoding.ts | stringAttribute | unchanged | 3 | 78.2% | 3.1 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 3 | 96.8% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | membersPage | changed | 3 | 98% | 3.0 | ok |
| src/accounts/organizations/administration-overviews.ts | invitationEntry | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-form.ts | memberRemovalIn | new | 3 | 100% | 3.0 | ok |
| src/interfaces/web/account/account-form.ts | readBody | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.answerSignedIn | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.route | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.switchAnswer | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | requireTrustedTenant | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | withCookies | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | new | 3 | 100% | 3.0 | ok |
| src/logs/audit/audit-log.ts | audit-log\AuditLog.administrationChanged | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/logs/audit/audit-log.ts | audit-log\AuditLog.destinationChanged | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/logs/audit/audit-log.ts | audit-log\AuditLog.toolCompleted | unchanged | 3 | 100% | 3.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | sendForm | unchanged | 2 | 98.3% | 2.0 | ok; unchanged by this PR |
| src/accounts/organizations/administration-overviews.ts | holdsUserSeat | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | adminGrants | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-form.ts | (anonymous) | new | 1 | 0% | 2.0 | ok |
| src/interfaces/web/account/account-form.ts | single | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-pages.ts | noOrganizationPage | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-pages.ts | removalResultPage | new | 2 | 100% | 2.0 | ok |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.handle | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | directoryUrl | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | identityPolicyText | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | rolesText | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.handlerFor | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.withScope | unchanged | 2 | 100% | 2.0 | ok; unchanged by this PR |
| src/accounts/organizations/administration-overviews.ts | (anonymous) | new | 1 | 100% | 1.0 | ok |
| src/accounts/organizations/administration-overviews.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/administration-overviews.ts | (anonymous) | new | 1 | 100% | 1.0 | ok |
| src/accounts/organizations/administration-overviews.ts | (anonymous) | new | 1 | 100% | 1.0 | ok |
| src/accounts/organizations/administration-overviews.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/administration-overviews.ts | activeUserSeatCount | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/administration-overviews.ts | memberEntry | changed | 1 | 100% | 1.0 | ok |
| src/accounts/organizations/administration-overviews.ts | readInvitationOverview | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/administration-overviews.ts | readMemberOverview | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/administration-overviews.ts | userSeatsOf | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | new | 1 | 100% | 1.0 | ok |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | currentAdmin | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/accounts/organizations/membership-removal-checks.ts | targetFacts | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-form.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-form.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-form.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-form.ts | (anonymous) | new | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/account-form.ts | account-form\ReturnDestinations.constructor | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-form.ts | account-form\ReturnDestinations.urlOf | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-form.ts | cancelOnAbort | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-pages.ts | (anonymous) | new | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/account-pages.ts | accessDeniedPage | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-pages.ts | noticePage | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-pages.ts | noticeResponse | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-pages.ts | seeOther | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-pages.ts | unconfirmedInvitationPage | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | (anonymous) | new | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | account-routes\HostedAccountRoutes.constructor | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/account-routes.ts | frozenCopy | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | (anonymous) | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | invitationRow | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-pages.ts | removalForm | new | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/administration-pages.ts | roleLabel | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | new | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | new | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes. | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.billingPage | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.constructor | changed | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.invitationsPage | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.membersPage | changed | 1 | 100% | 1.0 | ok |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.pathOf | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.resendInvitation | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.revokeInvitation | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/interfaces/web/account/administration-routes.ts | administration-routes\AdministrationRoutes.sendInvitation | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |
| src/logs/audit/audit-log.ts | audit-log\AuditLog.constructor | unchanged | 1 | 100% | 1.0 | ok; unchanged by this PR |

Known limit violations: 0. Measured target misses: 1. Unmeasured functions: 0. Required functions with unknown assessment or identity: 0.
