import { WebsiteFetchFailure, type FetchDiagnostic } from './fetch-diagnostic.ts';
export { WebsiteFetchFailure, type FetchDiagnostic } from './fetch-diagnostic.ts';
export interface WebsiteFetchResult {
    requestedUrl: string;
    finalUrl: string;
    html: string;
}
export interface WebsiteFetcher {
    fetchURL(url: string, signal?: AbortSignal): Promise<WebsiteFetchResult>;
}
export declare const WEBSITE_FETCH_READINESS_BUDGET_MS = 20000;
export declare class WebsiteFetchReadinessTimeoutError extends WebsiteFetchFailure {
    readonly category = "readiness_timeout";
    readonly budgetMs = 20000;
    constructor(options?: ErrorOptions, diagnostic?: FetchDiagnostic);
}
export declare class WebsiteFetchHttpError extends WebsiteFetchFailure {
    readonly status: number | undefined;
    readonly kind = "http";
    constructor(status: number | undefined, options?: ErrorOptions, diagnostic?: FetchDiagnostic);
}
export declare function systemErrorName(code: unknown): string;
export declare class WebsiteFetchLaunchError extends WebsiteFetchFailure {
    readonly kind = "launch";
    readonly code: string;
    readonly failure: 'missing' | 'cannot-start';
    constructor(code: unknown, message: string, options?: ErrorOptions, diagnostic?: FetchDiagnostic);
}
