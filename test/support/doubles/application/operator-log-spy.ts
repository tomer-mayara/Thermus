import type { SystemLog } from '../../../../src/logs/system/system-log.ts';

// A spy (Meszaros) of the operator log. It records each INFO line and each ERROR line. Thus a test can check the
// lines that the operator sees and that no secret gets into the log. The methods are arrow functions. Thus a caller
// can also use a method without the spy, for example as a callback.
export class OperatorLogSpy implements SystemLog {
  readonly lines: string[] = [];
  readonly info = (message: string): void => { this.lines.push(`INFO ${message}`); };
  readonly error = (message: string): void => { this.lines.push(`ERROR ${message}`); };
}
