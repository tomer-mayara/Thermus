import https from 'node:https';
import type { TLSSocket } from 'node:tls';
import { AUDIT_SEND_LIMITS, AuditSendFailure } from './audit-send.ts';
import type { AuditSendOutcome } from './audit-send.ts';
import { interpretAuditResponse } from './otlp-audit-response.ts';

export interface AuditExportRequest { readonly url: URL; readonly body: Buffer; readonly authorization?: string; readonly axiomDataset?: string }

/** Uses only a completed, checked TLS socket. Node's global agents and OTel defaults are not consulted. */
export function requestAuditExport(socket: TLSSocket, { url, body, authorization, axiomDataset }: AuditExportRequest, signal: AbortSignal): Promise<AuditSendOutcome> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const request = https.request({ hostname: url.hostname, port: url.port || 443, path: url.pathname, method: 'POST', createConnection: () => socket, maxHeaderSize: AUDIT_SEND_LIMITS.headerBytes, signal, headers: { 'content-type': 'application/json', 'content-length': body.length, connection: 'close', ...(authorization === undefined ? {} : { authorization }), ...(axiomDataset === undefined ? {} : { 'x-axiom-dataset': axiomDataset }) } }, (response) => {
      const chunks: Buffer[] = [];
      let received = 0;
      response.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > AUDIT_SEND_LIMITS.responseBytes) {
          resolve({ kind: 'unconfirmed', reason: 'response_too_large' });
          response.destroy(); request.destroy();
        } else { chunks.push(chunk); }
      });
      response.once('error', reject);
      response.once('aborted', () => reject(new AuditSendFailure({ kind: 'transient_failure', reason: 'transport' })));
      response.once('end', () => {
        if (received > AUDIT_SEND_LIMITS.responseBytes) return;
        if (response.statusCode === 200 && response.headers['content-encoding'] !== undefined && response.headers['content-encoding'] !== 'identity') return resolve({ kind: 'unconfirmed', reason: 'invalid_response' });
        resolve(interpretAuditResponse({ statusCode: response.statusCode ?? 0, contentType: response.headers['content-type'], retryAfter: response.headers['retry-after'], body: Buffer.concat(chunks, received) }));
      });
    });
    request.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'HPE_HEADER_OVERFLOW') return resolve({ kind: 'unconfirmed', reason: 'response_too_large' });
      reject(error);
    });
    request.end(body);
  });
}
