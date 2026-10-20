import type { SearchDocument, SearchEngine } from '../../../src/search-engine/search-engine.ts';
import type { WebsiteFetchResult } from '../../../src/website-fetcher/website-fetcher.ts';

const page = {
  requestedUrl: 'https://search.example/search?q=sources',
  finalUrl: 'https://search.example/search?q=sources',
  html: '<main>Search results</main>',
} satisfies WebsiteFetchResult;

export const results = { page, kind: 'results' } satisfies SearchDocument;
export const noResults = { page, kind: 'no_results' } satisfies SearchDocument;
// @ts-expect-error An unknown page is not a successful search classification.
export const unknownPage = { page, kind: 'unknown' } satisfies SearchDocument;
// @ts-expect-error A search document must retain the rendered page.
export const missingPage = { kind: 'results' } satisfies SearchDocument;
// @ts-expect-error A search document must classify the rendered page.
export const missingKind = { page } satisfies SearchDocument;
// @ts-expect-error The rendered page must retain its final URL and HTML.
export const incompletePage = { page: { requestedUrl: page.requestedUrl }, kind: 'results' } satisfies SearchDocument;
// @ts-expect-error Markdown cannot replace the rendered page.
export const markdownPage = { page: '# Results', kind: 'results' } satisfies SearchDocument;

export const engine = {
  search: async (_query: string, _signal: AbortSignal) => results,
} satisfies SearchEngine;

type SearchArguments = Parameters<SearchEngine['search']>;
const signal = AbortSignal.abort();

export const validArguments = ['sources', signal] satisfies SearchArguments;
// @ts-expect-error The query is required.
export const missingQuery = [] satisfies SearchArguments;
// @ts-expect-error The signal is required even if an implementation ignores it.
export const missingSignal = ['sources'] satisfies SearchArguments;
// @ts-expect-error The query must be a string.
export const invalidQuery = [42, signal] satisfies SearchArguments;
// @ts-expect-error The signal must be an AbortSignal.
export const invalidSignal = ['sources', {}] satisfies SearchArguments;
// @ts-expect-error Reason and provider options are not engine parameters.
export const extraArgument = ['sources', signal, 'Read for the task'] satisfies SearchArguments;

type SearchResult = Awaited<ReturnType<SearchEngine['search']>>;
export const returnedDocument = noResults satisfies SearchResult;
// @ts-expect-error The engine returns a document, not Markdown.
export const returnedMarkdown = '# Results' satisfies SearchResult;

type SearchPromise = ReturnType<SearchEngine['search']>;
export const promisedDocument = Promise.resolve(results) satisfies SearchPromise;
// @ts-expect-error The engine must return a Promise, not a plain document.
export const synchronousDocument = results satisfies SearchPromise;
