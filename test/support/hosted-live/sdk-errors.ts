// The pinned WorkOS SDK puts the HTTP status of a refused call in the status property of its error.
export function statusOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
}
