import { correspondenceOf, type Correspondence } from './correspondence.ts';
import { coverageShareOf, fileCrapOf, type FileCrap } from './crap.ts';
import type { MapSources } from './types.ts';

interface SnapshotCrap {
  readonly head: ReadonlyMap<string, FileCrap>;
  readonly base: ReadonlyMap<string, FileCrap>;
  readonly correspondence: Correspondence;
}

export function snapshotCrapOf(sources: MapSources): SnapshotCrap | undefined {
  const { base, head, coverage } = sources;
  if (coverage === undefined) return undefined;
  const correspondence = correspondenceOf(sources);
  const covered = new Map(coverage.files.map((file) => [file.path, file.functions]));
  const headCrap = new Map(head.files.map((file) => [file.path, fileCrapOf(file, coverageShareOf(covered.get(file.path), file))]));
  const baseCrap = base.files.map((file): [string, FileCrap] => {
    const shares = new Map((file.functions ?? []).map((fn) => {
      const partner = correspondence.base.get(fn);
      const index = partner?.file.functions?.indexOf(partner.fn);
      const share = partner && index !== undefined ? headCrap.get(partner.file.path)?.functions[index]?.share : undefined;
      return [fn, share];
    }));
    return [file.path, fileCrapOf(file, (fn) => shares.get(fn))];
  });
  return { head: headCrap, base: new Map(baseCrap), correspondence };
}
