# Controlled fixture correction history

The manager ran the builds and runtime checks. The worker did not run these commands.

1. Initial build failed with TS2769: the public export-sink contract makes `settingsObserved` optional, so `t.mock.method` did not accept its name. The correction asserts the real composed method exists and narrows the dispatch contract before installing the observer. The manager's retry build and typecheck passed.
2. Initial runtime run passed 2 of 4 cases. The retained-session journey and actual SQL outage passed. The reauthentication fixture relied on a removed membership's refresh refusal, which the controlled SDK path reported as HTTP 500. The correction explicitly ends the removed User's and Admin's controlled sessions immediately after each deletion. Their tokens remain expired so the next request uses the existing session-ending seam. This fixture models a provider that ends sessions; it does not relax the denial assertion.
3. The same run rejected export Save with HTTP 400. The fixture sent `auth: none` and omitted the destination choice. The current public form accepts `destination: custom`, `auth: bearer`, and `axiom_dataset: ''` for this case. The correction supplies those values and a nonsecret fixture Bearer token.
4. The next manager run passed 3 of 4 cases after a successful build. The reauthentication case expected an old other-workspace User session to remain usable after deliberately ending all User sessions. The correction signs the User in again for the other workspace before it checks authorized product access. Account and membership preservation remain separate from deliberate session revocation. The retained-session variant still checks the existing other-workspace session.

These were fixture or typing corrections. No production behavior changed. A new runtime run is pending after the fourth correction.
