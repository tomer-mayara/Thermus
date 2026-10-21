import { componentOf, validComponentId, type ComponentDefinitions } from '../../component-ownership.ts';
export const validComponentName = validComponentId;

export function componentNameOf(path: string, ownership?: ComponentDefinitions, legacyRoot = 'src'): string | undefined {
  const owner = componentOf(path, ownership);
  return ownership === undefined && owner === 'composition' ? legacyRoot : owner;
}
