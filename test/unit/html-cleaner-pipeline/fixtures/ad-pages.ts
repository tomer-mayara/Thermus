import { readFileSync } from 'node:fs';
import { repositoryRoot } from '../../../support/processes/module-paths.ts';

// The pages are data files of this package and not part of the build, so the path goes through the repository root of
// module-paths.ts and holds from the source tree and from dist/.
const pages = new URL('test/unit/html-cleaner-pipeline/fixtures/pages/', repositoryRoot);

export function readAdFixture(name: string): string {
  return readFileSync(new URL(name, pages), 'utf8');
}
