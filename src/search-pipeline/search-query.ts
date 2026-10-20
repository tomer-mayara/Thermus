export const SEARCH_QUERY_MAX_SCALARS = 512;

export function isValidSearchQuery(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  let length = 0;
  for (const _scalar of value) {
    length += 1;
    if (length > SEARCH_QUERY_MAX_SCALARS) return false;
  }
  return value.isWellFormed() && /\S/u.test(value);
}
