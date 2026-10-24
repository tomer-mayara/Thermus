# Checker declaration diagnostic

Final candidate `a3aef3f2633145c685feccd136f8638ce08d58d7`; base `7d01d2fb61c1ee0faebd1a1b78819902f832f5f4`. Final checker exits0 and emits pure JSON to tier.json with this stderr kept separately:

```text
pr-review-check: ignored 33 compiler errors in 2 files that public_surface does not list
```

These 33 permitted declaration-portability errors occur in 2 unchanged modules outside public_surface. No listed-module diagnostic occurred; API --check verifies 48 current snapshots and ordinary typecheck passes. The separate compiler-only declaration diagnostic probe is not the ordinary typecheck gate. The earlier mixed-stream wrapper parse failure is historical; do not count this allowed diagnostic as a failed required gate.
