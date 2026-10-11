# Fetch result URL metadata

`WebsiteFetcher.fetchURL(url)` returns a `WebsiteFetchResult` with three fields:

- `requestedUrl` is the exact string passed to `fetchURL`.
- `finalUrl` is the HTTP or HTTPS URL reported by the renderer for the returned page. It identifies the page after redirects.
- `html` is the rendered HTML for that page.

The requested URL records the caller's input. The final URL records where the renderer ended. Keep both values. For a direct fetch, both URLs identify the same page. The renderer can return a normalized URL in `finalUrl`; `requestedUrl` remains unchanged.

Pass the fetch result to the HTML-to-Markdown pipeline:

```ts
const page = await fetcher.fetchURL(url);
const result = await pipeline.process(page);
```

The pipeline carries both URLs and the HTML through its steps. It does not fetch the page again or make network requests to resolve links. Markdown conversion uses `finalUrl` as the base URL for relative, root-relative, and protocol-relative links. The ad cleaner also uses `finalUrl` when it selects host-specific rules. These behaviors apply after same-host and cross-host redirects.

## Checks

Run the configured check for type checking and unit tests:

```bash
npm run check
```

Run the interface tests separately to check the fetcher's renderer contract, including redirects:

```bash
npm run test:interface
```
