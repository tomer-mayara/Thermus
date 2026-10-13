export class WebsiteFetchHttpError extends Error {
    status;
    kind = 'http';
    constructor(status, options) {
        super(status === undefined ? 'HTTP request failed' : `HTTP request failed with status ${status}`, options);
        this.status = status;
        this.name = 'WebsiteFetchHttpError';
    }
}
//# sourceMappingURL=website-fetcher.js.map