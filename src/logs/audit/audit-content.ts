import type { AuditResult } from './audit-log.ts';

export const AUDIT_CAPTURE_LIMITS = Object.freeze({ resultBytes: 65_536, eventBytes: 131_072, metadataBytes: 1_024 });

const credentialName = /^(?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|key|password|passwd|secret|client[_-]?secret|authorization|auth|bearer|session[_-]?id|session|code|signature|sig|x-amz-(?:signature|credential|security-token)|x-goog-(?:signature|credential))$/i;
const credentialField = /(?<![?&\w])((?:["']?(?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|password|passwd|secret|client[_-]?secret|authorization|bearer)["']?)\s*[:=]\s*)(?:"(?:\\[\s\S]|[^"\\])*(?:"|\\?$)|'(?:\\[\s\S]|[^'\\])*(?:'|\\?$)|[^\s,;&}\r\n"']+)/gi;
const marker = '\n[TRUNCATED]';

/** Redacts recognized credential fields, including URL parameters in public text. */
export function redactAuditText(text: string): string {
  return text
    .replace(/([?&])([^=&#\s<>"']+)=([^&#\s]*)/g, (whole: string, separator: string, key: string) => {
      try {
        return credentialName.test(decodeURIComponent(key.replace(/\+/g, ' '))) ? `${separator}${key}=[REDACTED]` : whole;
      } catch {
        return `${separator}[REDACTED]`;
      }
    })
    .replace(/(\bauthorization\s*[:=]\s*)(?:bearer|basic)\s+[^\s,;"'<>]+/gi, '$1[REDACTED]')
    .replace(credentialField, '$1"[REDACTED]"');
}

function prefixWithin(text: string, byteLimit: number, jsonLimit: number): string {
  let bytes = 0;
  let jsonBytes = 0;
  let end = 0;
  for (const point of text) {
    const nextBytes = Buffer.byteLength(point);
    const nextJsonBytes = Buffer.byteLength(JSON.stringify(point)) - 2;
    if (bytes + nextBytes > byteLimit || jsonBytes + nextJsonBytes > jsonLimit) break;
    bytes += nextBytes;
    jsonBytes += nextJsonBytes;
    end += point.length;
  }
  return text.slice(0, end);
}

/** The caller reserves the serialized input and metadata before allocating result text. */
export function captureAuditResult(result: string, metadataBytes: number): AuditResult {
  const originalBytes = Buffer.byteLength(result);
  const source = prefixWithin(result, AUDIT_CAPTURE_LIMITS.resultBytes, Number.POSITIVE_INFINITY);
  const redacted = redactAuditText(source.toWellFormed());
  const jsonLimit = AUDIT_CAPTURE_LIMITS.eventBytes - metadataBytes;
  let text = prefixWithin(redacted, AUDIT_CAPTURE_LIMITS.resultBytes, jsonLimit);
  const truncated = source.length < result.length || text.length < redacted.length;
  if (truncated) {
    text = prefixWithin(redacted, AUDIT_CAPTURE_LIMITS.resultBytes - Buffer.byteLength(marker), jsonLimit - (Buffer.byteLength(JSON.stringify(marker)) - 2)) + marker;
  }
  return { text, originalBytes, capturedBytes: Buffer.byteLength(text), truncated };
}
