# Staging launcher

The documented private launcher still permits only the earlier
3-headed-monkey/Thermus repository URL. The current canonical origin is
tomer-mayara/Thermus. Read-only ls-remote checks of both URLs resolved the
UI-01 branch to a017020ebe2448f5de6cc7d9cbb0700367fc80b1.

An ignored task-local copy adds only the exact canonical HTTPS origin to the
existing allowlist. It keeps the Keychain service/account, staging-key prefix,
client ID, staging issuer, subprocess settings and signal handling unchanged.
The user's launcher and Git origin are unchanged. A boolean-only preflight
confirmed a staging key and the expected staging issuer. No key was printed.
The private launcher is excluded from published evidence.
