# Documentation

Completed implementation plans belong in `archive/`. Current contracts and
runtime guides stay current after implementation.

## Working guidance

- [Coding principles](coding-principles.md): design and verification guidance.
- [Lightpanda runtime](lightpanda-runtime.md): runtime installation and renderer checks.
- [Test gate policy](implementation/test-gate-policy.md): suite commands, required runs before Ready, and later release gates.

## Current reference

- [Website fetcher](reference/website-fetcher.md): rendering, readiness, and error behavior.
- [Fetch result URL metadata](reference/fetch-result-url-metadata.md): requested and final URLs.
- [Renderer network policy](reference/renderer-network-policy.md): destination checks and network restrictions.
- [Ad rules](reference/ad-rules.md): trusted rule input and cleaner behavior.
- [Hidden-text sanitizer](reference/hidden-text-sanitizer.md): hidden content and control sanitation.
- [HTML processing limits](reference/html-processing-limits.md): parsed element depth and failure behavior.
- [Pipeline metrics](reference/pipeline-metrics.md): removal counts, skipped work, and findings.

## Design and testing

- [Authentication implementation plan](design/authentication-design.md): provider contracts, offline local accounts in one shared workspace, hosted scope, and implementation gates.
- [Planned cache key design](design/cache-design.md): pending cache requirements.
- [Test inventory](testing/test-list.md): executed cases and pending cache tests.

## Archive

- [Completed OO refactoring record](archive/oo-refactoring-plan.md): implementation scope, recorded verification, and deferred design decisions.
