import { WebsiteFetchLaunchError, WebsiteFetchReadinessTimeoutError, type FetchDiagnostic } from './website-fetcher.ts';
export type RendererSetupFailure = Pick<WebsiteFetchLaunchError, 'failure' | 'code'>;
type RendererReadinessTimeout = Pick<WebsiteFetchReadinessTimeoutError, 'category' | 'budgetMs'>;
export interface RendererFailureReports {
    reportFetchFailure?: (failure: FetchDiagnostic & {
        operationId: string;
    }) => void;
    reportRendererSetupFailure?: (failure: RendererSetupFailure) => void;
    reportRendererReadinessTimeout?: (failure: RendererReadinessTimeout) => void;
}
export declare function reportRendererFailure(reports: RendererFailureReports, error: unknown, operationId: string): void;
export {};
