import { realpathSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { CommandError } from './repository.ts';

// The server names a file by its path from the root, with forward slashes. git gives the physical path of the root,
// so the folder of the path is resolved too: on macOS the temporary folders are symbolic links. A folder that does
// not exist stays as it is; the server then tells that it does not know the file.
export function rootPathOf(root: string, path: string): string {
  const absolute = resolve(path);
  let folder = dirname(absolute);
  try { folder = realpathSync(folder); } catch { /* The folder does not exist. */ }
  const fromRoot = relative(root, join(folder, basename(absolute)));
  if (fromRoot === '' || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) throw new CommandError(`The path must name a file in the repository root ${root}.`);
  return fromRoot.split(sep).join('/');
}
