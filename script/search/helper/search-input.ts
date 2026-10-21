import { FetchUrlError } from '../../fetch-url/helper/errors.ts';

export function validateSearchText(query: string | undefined, reason: string | undefined): void {
  if (query === undefined || query.trim() === '' || !query.isWellFormed() || [...query].length > 512) {
    throw new FetchUrlError('Supply a nonblank --query with 1 to 512 Unicode scalar values.');
  }
  if (reason === undefined || reason.trim() === '' || [...reason].length > 2000) {
    throw new FetchUrlError('Supply a nonblank --reason with 1 to 2000 Unicode code points.');
  }
}
