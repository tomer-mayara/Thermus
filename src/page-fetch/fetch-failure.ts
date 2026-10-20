import { constants } from 'node:os';

const launchCodes = new Set(['ENOENT', 'EACCES', 'ENOEXEC', 'ENOTDIR']);
const dnsCodes = new Set<unknown>(['ENOTFOUND', 'EAI_AGAIN']);
const rendererDetails = new Map<unknown, string>([
  ['HttpError', 'HTTP request failed (status unavailable)'],
  ['OperationTimedout', 'Renderer request timed out'],
  ['CouldntResolveHost', 'DNS lookup failed'],
  ['CouldntResolveProxy', 'DNS lookup failed'],
  ['CouldntConnect', 'Renderer connection failed'],
  ['NoConnectionAvailable', 'Renderer connection failed'],
  ['SslConnectError', 'Renderer TLS failed'],
  ['PeerFailedVerification', 'Renderer TLS failed'],
  ['SslCertproblem', 'Renderer TLS failed'],
  ['SslCacertBadfile', 'Renderer TLS failed'],
  ['SslIssuerError', 'Renderer TLS failed'],
  ['SslPinnedpubkeynotmatch', 'Renderer TLS failed'],
  ['SslInvalidcertstatus', 'Renderer TLS failed'],
  ['UseSslFailed', 'Renderer TLS failed'],
  ['TooManyRedirects', 'Renderer redirect limit exceeded'],
  ['ReadError', 'Renderer transfer failed'],
  ['SendError', 'Renderer transfer failed'],
  ['RecvError', 'Renderer transfer failed'],
]);

export class PageFetchFailure extends Error {
  readonly #publicMessage: string;

  public constructor(diagnostic?: unknown) {
    const detail = failureDetail(diagnostic);
    const message = detail === undefined ? 'Page fetch failed' : `Page fetch failed: ${detail}`;
    super(message);
    this.#publicMessage = message;
    this.name = 'PageFetchFailure';
  }

  public get publicMessage(): string { return this.#publicMessage; }
}

function failureDetail(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const diagnostic = value as Record<string, unknown>;
  switch (diagnostic.phase) {
    case 'destination_policy': return destinationFailureDetail(diagnostic);
    case 'renderer_launch': return diagnostic.category === 'launch' ? launchDetail(diagnostic.processErrorCode) : undefined;
    case 'renderer_process':
      return diagnostic.category === 'readiness_timeout' ? 'Renderer readiness timed out' : rendererDetail(diagnostic);
    case 'renderer_result': return rendererDetail(diagnostic);
    default: return undefined;
  }
}

function destinationFailureDetail(diagnostic: Record<string, unknown>): string | undefined {
  if (diagnostic.category === 'dns_timeout') return 'DNS lookup timed out';
  return dnsCodes.has(diagnostic.processErrorCode) ? 'DNS lookup failed' : undefined;
}

function launchDetail(code: unknown): string {
  return typeof code === 'string' && launchCodes.has(code) ? `Renderer could not start (${code})` : 'Renderer could not start';
}

function rendererDetail(diagnostic: Record<string, unknown>): string | undefined {
  const process = interruptedProcessDetail(diagnostic);
  if (process !== undefined) return process;
  if (diagnostic.category === 'http') return httpFailureDetail(diagnostic.httpStatus);
  if (diagnostic.category === 'renderer' && diagnostic.phase === 'renderer_result') return rendererDetails.get(diagnostic.rendererErrorCode);
  return exitedProcessDetail(diagnostic.exitCode);
}

function httpFailureDetail(status: unknown): string {
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599
    ? `HTTP ${status}` : 'HTTP request failed (status unavailable)';
}

function exitedProcessDetail(exitCode: unknown): string | undefined {
  return typeof exitCode === 'number' && Number.isInteger(exitCode) && exitCode > 0 && exitCode <= 255
    ? 'Renderer process failed' : undefined;
}

function interruptedProcessDetail(diagnostic: Record<string, unknown>): string | undefined {
  if (diagnostic.killed === true) return 'Renderer process was killed';
  if (typeof diagnostic.signal === 'string' && Object.hasOwn(constants.signals, diagnostic.signal)) return 'Renderer process was interrupted';
  if (diagnostic.processErrorCode === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return 'Renderer output limit exceeded';
  return undefined;
}
