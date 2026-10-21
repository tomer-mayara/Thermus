## Metrics findings retained

All four stages completed. Delta, CRAP, and architecture passed. Review reports a goal miss; it is not a failed or unavailable stage. No production file changed, so no production MI or CRAP goal applies. Coverage was not collected for this test-only scope. No rule, baseline, exception, or coverage report was changed.

The 62 high maintainability findings in the source files below are **unchanged by this PR**. Each file has the same committed content as the merge base. Their existing scores are not a regression caused by this cleanup.

| File | Finding | Reason |
| --- | --- | --- |
| `src/accounts/billing/billing-free.ts` | Maintainability too low: got 68 (min: 85) | unchanged by this PR |
| `src/accounts/identity/access-context.ts` | Maintainability too low: got 79 (min: 85) | unchanged by this PR |
| `src/accounts/organizations/change-records.ts` | Maintainability too low: got 73 (min: 85) | unchanged by this PR |
| `src/accounts/organizations/organization-administration.ts` | Maintainability too low: got 65 (min: 85) | unchanged by this PR |
| `src/accounts/providers/better-auth/better-auth-provider.ts` | Maintainability too low: got 73 (min: 85) | unchanged by this PR |
| `src/accounts/providers/better-auth/better-auth-runtime.ts` | Maintainability too low: got 82 (min: 85) | unchanged by this PR |
| `src/accounts/providers/better-auth/better-auth-user-administration.ts` | Maintainability too low: got 76 (min: 85) | unchanged by this PR |
| `src/accounts/providers/better-auth/local-installation.ts` | Maintainability too low: got 84 (min: 85) | unchanged by this PR |
| `src/accounts/providers/workos/hosted-role-mapping.ts` | Maintainability too low: got 84 (min: 85) | unchanged by this PR |
| `src/accounts/providers/workos/workos-auth-provider.ts` | Maintainability too low: got 72 (min: 85) | unchanged by this PR |
| `src/accounts/providers/workos/workos-browser-session.ts` | Maintainability too low: got 62 (min: 85) | unchanged by this PR |
| `src/accounts/providers/workos/workos-google-onboarding.ts` | Maintainability too low: got 48 (min: 85) | unchanged by this PR |
| `src/accounts/providers/workos/workos-organizations.ts` | Maintainability too low: got 60 (min: 85) | unchanged by this PR |
| `src/accounts/providers/workos/workos-settings.ts` | Maintainability too low: got 80 (min: 85) | unchanged by this PR |
| `src/accounts/providers/workos/workos-sign-in.ts` | Maintainability too low: got 65 (min: 85) | unchanged by this PR |
| `src/accounts/providers/workos/workos-signup.ts` | Maintainability too low: got 38 (min: 85) | unchanged by this PR |
| `src/app/hidden-line-input.ts` | Maintainability too low: got 80 (min: 85) | unchanged by this PR |
| `src/app/hosted-portal.ts` | Maintainability too low: got 47 (min: 85) | unchanged by this PR |
| `src/app/operation-capacity.ts` | Maintainability too low: got 65 (min: 85) | unchanged by this PR |
| `src/interfaces/cli/local-auth-command-line.ts` | Maintainability too low: got 84 (min: 85) | unchanged by this PR |
| `src/interfaces/cli/local-auth-command.ts` | Maintainability too low: got 84 (min: 85) | unchanged by this PR |
| `src/interfaces/mcp/identity-verifier-sdk-adapter.ts` | Maintainability too low: got 62 (min: 85) | unchanged by this PR |
| `src/interfaces/mcp/mcp-server.ts` | Maintainability too low: got 43 (min: 85) | unchanged by this PR |
| `src/interfaces/mcp/protected-resource-endpoint.ts` | Maintainability too low: got 64 (min: 85) | unchanged by this PR |
| `src/interfaces/user-portal/connection-guide.ts` | Maintainability too low: got 42 (min: 85) | unchanged by this PR |
| `src/interfaces/web/account/account-routes.ts` | Maintainability too low: got 61 (min: 85) | unchanged by this PR |
| `src/interfaces/web/account/administration-routes.ts` | Maintainability too low: got 59 (min: 85) | unchanged by this PR |
| `src/interfaces/web/auth/better-auth/local-auth-pages.ts` | Maintainability too low: got 41 (min: 85) | unchanged by this PR |
| `src/interfaces/web/auth/better-auth/local-auth-provider-routes.ts` | Maintainability too low: got 67 (min: 85) | unchanged by this PR |
| `src/interfaces/web/auth/workos/workos-session-routes.ts` | Maintainability too low: got 62 (min: 85) | unchanged by this PR |
| `src/interfaces/web/auth/workos/workos-signup-routes.ts` | Maintainability too low: got 39 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/ad-cleaner/adb/clean-html-ads-adblock-rs.ts` | Maintainability too low: got 37 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/ad-cleaner/adb/source-range-parser.ts` | Maintainability too low: got 51 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/ad-cleaner/html-depth-limit-error.ts` | Maintainability too low: got 84 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/html-to-markdown-pipeline.ts` | Maintainability too low: got 69 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts` | Maintainability too low: got 63 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/html-to-markdown/prepare-html-document.ts` | Maintainability too low: got 59 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/process-html-step.ts` | Maintainability too low: got 59 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/prompt-injection-remover/css-opacity-animations.ts` | Maintainability too low: got 68 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/prompt-injection-remover/css-selector-index.ts` | Maintainability too low: got 33 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/prompt-injection-remover/css-visibility-provenance.ts` | Maintainability too low: got 53 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/prompt-injection-remover/css-visibility-tree.ts` | Maintainability too low: got 55 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/prompt-injection-remover/hidden-html-removal-counts.ts` | Maintainability too low: got 61 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/prompt-injection-remover/hidden-html-removal-session.ts` | Maintainability too low: got 63 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/prompt-injection-remover/hidden-html-scanner.ts` | Maintainability too low: got 34 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/prompt-injection-remover/html-text-source-ranges.ts` | Maintainability too low: got 67 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/prompt-injection-remover/prompt-injection-remover-sanitizer.ts` | Maintainability too low: got 50 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/prompt-injection-remover/small-text-policy.ts` | Maintainability too low: got 66 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/search-results/brave-http-result-cleanup.ts` | Maintainability too low: got 74 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/search-results/brave-result-document.ts` | Maintainability too low: got 43 (min: 85) | unchanged by this PR |
| `src/pipelines/html-processing/search-results/brave-result-fields.ts` | Maintainability too low: got 58 (min: 85) | unchanged by this PR |
| `src/pipelines/page-fetch/fetch-failure.ts` | Maintainability too low: got 71 (min: 85) | unchanged by this PR |
| `src/pipelines/providers/search-engine/search-engine-brave-http.ts` | Maintainability too low: got 34 (min: 85) | unchanged by this PR |
| `src/pipelines/providers/website-fetcher/fetch-diagnostic.ts` | Maintainability too low: got 81 (min: 85) | unchanged by this PR |
| `src/pipelines/providers/website-fetcher/network-policy.ts` | Maintainability too low: got 61 (min: 85) | unchanged by this PR |
| `src/pipelines/providers/website-fetcher/website-fetcher-lightpanda.ts` | Maintainability too low: got 71 (min: 85) | unchanged by this PR |
| `src/pipelines/providers/website-fetcher/website-fetcher.ts` | Maintainability too low: got 80 (min: 85) | unchanged by this PR |
| `src/pipelines/search/search-failure.ts` | Maintainability too low: got 71 (min: 85) | unchanged by this PR |
| `src/pipelines/search/search-pipeline.ts` | Maintainability too low: got 47 (min: 85) | unchanged by this PR |
| `src/pipelines/search/search-query.ts` | Maintainability too low: got 65 (min: 85) | unchanged by this PR |
| `src/runtime/config/ad-rules-file.ts` | Maintainability too low: got 82 (min: 85) | unchanged by this PR |
| `src/runtime/config/deployment-config.ts` | Maintainability too low: got 84 (min: 85) | unchanged by this PR |

The remaining high finding is `test/support/hosted-live/workos-api.ts`: MI 64.77 → 56.80. Removing the unused `readWorkOSList` function changes the aggregate score of this smaller file; the remaining functions keep the same implementation and staging API responsibilities. Test support has no MI goal. The deletion keeps the support module limited to the remaining tests. The retained hosted live tests passed.

The architecture report retains its notices about the unchanged unresolved CSS import and unknown function correspondence. No coverage comparison is claimed. The map did not change. The immutable base history record was generated by the process and committed without edits.
