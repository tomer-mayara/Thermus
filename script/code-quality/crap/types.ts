import type { FunctionCrap } from '../architecture/crap.ts';

export interface GoalFunction extends FunctionCrap {
  readonly file: string;
  readonly change: 'new' | 'changed' | 'unchanged' | 'unknown';
  readonly identity: string;
}

export interface CrapGoals {
  readonly limit: number;
  readonly target: number;
}
