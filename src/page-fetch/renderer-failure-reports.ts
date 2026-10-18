import { WebsiteFetchLaunchError, WebsiteFetchReadinessTimeoutError } from '../website-fetcher/website-fetcher.ts';

export type RendererSetupFailure = Pick<WebsiteFetchLaunchError, 'failure' | 'code'>;
type RendererReadinessTimeout = Pick<WebsiteFetchReadinessTimeoutError, 'category' | 'budgetMs'>;

export interface RendererFailureReports {
  reportRendererSetupFailure?: (failure: RendererSetupFailure) => void;
  reportRendererReadinessTimeout?: (failure: RendererReadinessTimeout) => void;
}

// Renderer errors can contain request data. Reports receive only these fixed fields.
export function reportRendererFailure(reports: RendererFailureReports, error: unknown): void {
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
