import type { StageReport } from '../shared/report.ts';

export interface ProcessOptions {
  readonly base: string;
  readonly coverage?: string;
  readonly collectCoverage: boolean;
  readonly skipCoverage: boolean;
  readonly out?: string;
  readonly json?: string;
  readonly allowToolVersion: boolean;
}

export interface CoverageChoice { readonly file?: string; readonly notice: string; readonly required: boolean }
export interface ArchitectureAnalysis { readonly text: string; publish(): string }

export interface ProcessOperations {
  delta(): StageReport;
  review(): StageReport;
  coverage(): CoverageChoice;
  crap(): Promise<StageReport>;
  architecture(choice: CoverageChoice): Promise<ArchitectureAnalysis>;
}

export interface StageOutcome {
  readonly name: string;
  readonly status: 'passed' | 'goal miss' | 'failed' | 'unavailable';
  readonly text: string;
}

export interface ProcessResult extends StageReport {
  readonly outcomes: readonly StageOutcome[];
}
