# Magumagu

Node 24 ESM package. TypeScript compiles with `tsc`, and Node runs the output in `dist/`. `tsx` is only for local development.

## Requirements

- Node 24 (`nvm use` reads `.nvmrc`)
- pnpm 12.10.1

## Scripts

```bash
pnpm install
pnpm dev         # tsx watch src/index.ts
pnpm build       # tsc
pnpm start       # node dist/src/index.js
pnpm test        # tsc, then node --test on dist/test/
pnpm typecheck   # tsc --noEmit
```

`pnpm start` runs `dist/src/index.js` because `src/` and `test/` share one compilation root. A test import such as `../src/hello.js` still resolves after emit.

## Layout

```
src/     TypeScript source
test/    node:test files
dist/    tsc output (gitignored)
```

## TypeScript

`tsconfig.json` is ESM with `module` and `moduleResolution` set to `NodeNext`, in strict mode, targeting ES2024. Relative imports use the `.js` extension that `tsc` emits:

```ts
import { hello } from './hello.js';
```
