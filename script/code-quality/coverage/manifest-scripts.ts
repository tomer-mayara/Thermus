import type { MergedCoverage } from './merge.ts';
import { objectOf } from '../shared/json.ts';

type CapturedScript = { readonly path: string; readonly representation: 'source-typescript' | 'emitted-javascript'; readonly contentIdentity: string };
export function scriptIdentitiesOf({ scripts }: MergedCoverage): readonly CapturedScript[] {
  return [...scripts].map(([path, script]) => ({ path, representation: script.representation, contentIdentity: script.contentIdentity })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
export function scriptIdentitiesIn(value: unknown): readonly CapturedScript[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const scripts: CapturedScript[] = [];
  for (const item of value) {
    const script = scriptIdentityIn(item);
    if (script === undefined || scripts.some(({ path }) => path === script.path)) return undefined;
    scripts.push(script);
  }
  return scripts;
}
function scriptIdentityIn(value: unknown): CapturedScript | undefined {
  const { path, representation, contentIdentity } = objectOf(value);
  if (typeof path !== 'string' || !/^src\/.+\.ts$/.test(path) || path.split('/').includes('..')) return undefined;
  if (representation !== 'source-typescript' && representation !== 'emitted-javascript') return undefined;
  if (typeof contentIdentity !== 'string' || !/^[a-f0-9]{64}$/.test(contentIdentity)) return undefined;
  return { path, representation, contentIdentity };
}
