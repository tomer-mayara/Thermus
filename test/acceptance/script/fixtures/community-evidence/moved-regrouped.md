### Community edge evidence

Tool references and deduplicated file pairs have different units. An unchanged import means the same normalized file pair, after proven path moves; evidence kinds can differ.

- alpha → beta · gone: 17 tool references; 1 deduplicated file pair.
  - `src/a/client.ts` → `src/b/moved.ts` — unchanged import; community regrouping.

- alpha → gamma · new: 17 tool references; 1 deduplicated file pair.
  - `src/new/client.ts` → `src/new/moved.ts` — unchanged import; community regrouping.

### Proven path moves

- `src/a/client.ts` → `src/new/client.ts`.
- `src/b/moved.ts` → `src/new/moved.ts`.

### Community regrouping

- `src/new/moved.ts`: beta → gamma.
