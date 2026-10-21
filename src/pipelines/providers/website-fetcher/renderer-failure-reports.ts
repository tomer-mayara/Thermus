import { WebsiteFetchFailure, WebsiteFetchLaunchError, WebsiteFetchReadinessTimeoutError, type FetchDiagnostic } from './website-fetcher.ts';

export type RendererSetupFailure = Pick<WebsiteFetchLaunchError, 'failure' | 'code'>;
type RendererReadinessTimeout = Pick<WebsiteFetchReadinessTimeoutError, 'category' | 'budgetMs'>;

export interface RendererFailureReports {
  reportFetchFailure?: (failure: FetchDiagnostic & { operationId: string }) => void;
  reportRendererSetupFailure?: (failure: RendererSetupFailure) => void;
  reportRendererReadinessTimeout?: (failure: RendererReadinessTimeout) => void;
}

// Renderer errors can contain request data. Reports receive only these fixed fields.
export function reportRendererFailure(reports: RendererFailureReports, error: unknown, operationId: string): void {
  try {
    reports.reportFetchFailure?.({ ...(error instanceof WebsiteFetchFailure ? error.diagnostic : { category: 'unknown' as const, phase: 'unknown' as const }), operationId });
  } catch {
    // Reporting cannot change the operation result.
  }
  try {
    if (error instanceof WebsiteFetchLaunchError) {
      reports.reportRendererSetupFailure?.({ failure: error.failure, code: error.code });
    }
    if (error instanceof WebsiteFetchReadinessTimeoutError) {
      reports.reportRendererReadinessTimeout?.({ category: error.category, budgetMs: error.budgetMs });
    }
  } catch {
    // Reporting cannot change the operation result.
  }
}
