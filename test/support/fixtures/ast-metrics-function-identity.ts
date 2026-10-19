import { createHash } from 'node:crypto';
import type { FunctionIdentity, SourceEvidence } from '../../../script/code-quality/identity/types.ts';

export const completeSourceEvidence: SourceEvidence = { version: 'typescript-tokens-v1', coordinates: 'utf16', complete: true };

// Synthetic declarations have one distinct body per name and path count. A path-count edit changes that body.
export function functionIdentityOf(name: string, paths: number): FunctionIdentity | undefined {
  if (name === '(anonymous)' || name.endsWith('.')) return undefined;
  const metric = name.slice(name.lastIndexOf('\\') + 1);
  const member = /^([^.]*)\.(.+)$/u.exec(metric);
  const declaration = member === null
    ? { kind: 'FunctionDeclaration', owner: '', name: metric }
    : { kind: member[2] === 'constructor' ? 'Constructor' : 'MethodDeclaration', owner: `ClassDeclaration:${member[1]}`, name: member[2] };
  const start = Number.parseInt(createHash('sha256').update(name).digest('hex').slice(0, 6), 16) * 100;
  return {
    version: 'typescript-tokens-v1', ...declaration, start, end: start + 20,
    body: createHash('sha256').update(`${name}:${paths}`).digest('hex'),
    signature: createHash('sha256').update('():void').digest('hex'),
  };
}
