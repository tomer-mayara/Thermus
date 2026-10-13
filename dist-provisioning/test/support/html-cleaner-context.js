export function createContext(html, overrides = {}) {
    return {
        requestedUrl: 'https://example.com/start',
        finalUrl: 'https://example.com/final',
        html,
        removed: 0,
        skipped: 0,
        ...overrides,
    };
}
export function createContextForUrl(html, url = 'https://example.com/') {
    return createContext(html, { requestedUrl: url, finalUrl: url });
}
//# sourceMappingURL=html-cleaner-context.js.map