export interface SystemLog {
  info(message: string): void;
  error(failure: unknown): void;
}
