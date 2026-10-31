import type { Page } from '../../organizations/organization-directory.ts';

// The largest page that WorkOS gives.
export const PAGE_SIZE = 100;

export interface WorkOSList<T> {
  readonly data: readonly T[];
  readonly listMetadata: { readonly after?: string | null };
}

export function afterOf(cursor: string | undefined): { readonly after?: string } {
  return cursor === undefined ? {} : { after: cursor };
}

// WorkOS gives the cursor of the next page in its list metadata. The last page has none, or an empty one.
export function pageOf<T>(records: readonly T[], after: string | null | undefined): Page<T> {
  const items = Object.freeze([...records]);
  return Object.freeze(typeof after === 'string' && after !== '' ? { items, next: after } : { items });
}

// A WorkOS 404 means that the record does not exist. Each other failure reaches the caller.
export async function unlessNotFound<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    if (hasStatus(error, 404)) return undefined;
    throw error;
  }
}

// The SDK gives the status and the code of a WorkOS answer on its errors, for example on NotFoundException,
// BadRequestException, and GenericServerException. Thus this module reads them by shape, not by class.
export function hasStatus(error: unknown, status: number): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === status;
}

export function hasCode(error: unknown, codes: ReadonlySet<unknown>): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && codes.has(error.code);
}
