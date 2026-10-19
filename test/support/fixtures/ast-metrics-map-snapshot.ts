import type { MapSnapshot } from '../../../script/code-quality/architecture/types.ts';

// The map and table fixtures share complete snapshot metadata. Each case supplies its measured files and communities.
export function mapSnapshotOf(files: MapSnapshot['files'], communities: MapSnapshot['communities'] = [], cycles: MapSnapshot['global']['cycles'] = []): MapSnapshot {
  return {
    commit: 'c0ffee00c0ffee00', date: '2026-10-18T00:00:00-06:00',
    global: {
      modularity: 0.5, crossShare: 0.25, cycles,
      paths: files.reduce((total, file) => total + (file.paths ?? 0), 0),
      files: files.length, functions: files.reduce((total, file) => total + (file.functions?.length ?? 0), 0),
    },
    communities, files,
  };
}
