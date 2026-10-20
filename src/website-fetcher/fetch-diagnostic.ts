import { constants } from 'node:os';
import type { ExecFileException } from 'node:child_process';

export interface FetchDiagnostic {
  readonly category: 'http' | 'renderer' | 'unknown' | 'validation' | 'launch' | 'readiness_timeout' | 'dns_timeout';
  readonly phase: 'renderer_result' | 'renderer_process' | 'renderer_launch' | 'destination_policy' | 'url_validation' | 'unknown';
  readonly httpStatus?: number;
  readonly rendererErrorCode?: RendererErrorCode;
  readonly exitCode?: number;
  readonly processErrorCode?: string;
  readonly signal?: string;
  readonly killed?: boolean;
  readonly budgetMs?: number;
  readonly metadata?: 'absent' | 'invalid';
  readonly reason?: 'dns_pending' | 'no_addresses' | 'blocked_destination' | 'invalid_http_status' | 'invalid_result' | 'invalid_final_url' | 'invalid_url' | 'unsupported_protocol';
}

const rendererCodes = [
  'HttpError', 'OperationTimedout', 'CouldntResolveHost', 'CouldntResolveProxy', 'CouldntConnect', 'NoConnectionAvailable',
  'SslConnectError', 'PeerFailedVerification', 'SslCertproblem', 'SslCacertBadfile', 'SslIssuerError',
  'SslPinnedpubkeynotmatch', 'SslInvalidcertstatus', 'UseSslFailed', 'TooManyRedirects', 'ReadError', 'SendError', 'RecvError',
] as const;
type RendererErrorCode = typeof rendererCodes[number] | 'unknown';
const knownRendererCodes: ReadonlySet<unknown> = new Set(rendererCodes);

const processCodes = new Set(['ENOENT', 'EACCES', 'ENOEXEC', 'EAGAIN', 'EMFILE', 'ENFILE', 'ENOMEM', 'EINVAL', 'EPERM', 'ENOTDIR', 'EISDIR', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER']);

// Only fixed names cross the logging boundary. A pattern alone can admit secret text.
export function safeProcessCode(code: unknown): string {
  return typeof code === 'string' && processCodes.has(code) ? code : 'unknown';
}

export function processDiagnostic(error: unknown): Partial<FetchDiagnostic> {
  if (typeof error !== 'object' || error === null) return {};
  const { code, signal, killed } = error as ExecFileException;
  return {
    ...(Number.isSafeInteger(code) && Number(code) >= 0 && Number(code) <= 255 ? { exitCode: Number(code) } : {}),
    ...(typeof code === 'string' ? { processErrorCode: safeProcessCode(code) } : {}),
    ...(typeof signal === 'string' && Object.hasOwn(constants.signals, signal) ? { signal } : {}),
    ...(typeof killed === 'boolean' ? { killed } : {}),
  };
}

export function resultDiagnostic(result: Record<string, unknown>): Partial<FetchDiagnostic> {
  const status = result.http_status;
  const code = result.error;
  return {
    ...(Number.isInteger(status) && Number(status) >= 100 && Number(status) <= 599 ? { httpStatus: Number(status) } : {}),
    ...(code === null || code === undefined ? {} : { rendererErrorCode: knownRendererCodes.has(code) ? code as RendererErrorCode : 'unknown' }),
  };
}

export class WebsiteFetchFailure extends Error {
  public constructor(message: string, public readonly diagnostic: FetchDiagnostic, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WebsiteFetchFailure';
  }
}
