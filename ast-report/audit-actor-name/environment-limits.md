# Container gate storage limit

The first self-hosted container gate at 05b0d00d failed before tests ran. The pinned Lightpanda download completed, but Docker could not copy it because the Colima filesystem was full. This is an environment failure, not a passing gate. `self-hosted-initial-disk-failure.log` and its command metadata retain the failure.

The Docker filesystem is 25 GB and reported zero available space. The host filesystem has separate free space; it does not enlarge the VM automatically. Removing unused build cache older than 24 hours freed 0 bytes. A second cleanup of unused build cache older than one hour freed 361.1 MB, which did not resolve the limit. No container, image, or volume was deleted, and no VM configuration was changed.

There are 219 unused anonymous Docker volumes, approximately 8.3 GB. Their ownership cannot be established from the anonymous labels. The user was asked before removing possible retained data. Approval is pending. The hosted image/offline-build gate has not started under this constraint. Both container gates remain required before Ready; local unit, integration, acceptance, Collector, and WorkOS staging passes do not replace them.
