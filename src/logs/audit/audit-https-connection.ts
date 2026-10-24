import tls from 'node:tls';
import type { LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import { AuditSendFailure } from './audit-send.ts';
import { sameAuditAddress } from './public-audit-destination.ts';

export async function closeAuditSocket(socket: tls.TLSSocket): Promise<void> {
  if (socket.closed) return;
  const closed = new Promise<void>((resolve) => socket.once('close', resolve));
  socket.destroy();
  await closed;
}

export async function connectAuditTls(url: URL, address: LookupAddress, signal: AbortSignal): Promise<tls.TLSSocket> {
  signal.throwIfAborted();
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const socket = tls.connect({ host: address.address, port: Number(url.port || 443), servername: isIP(hostname) ? undefined : hostname, rejectUnauthorized: true, minVersion: 'TLSv1.2', ALPNProtocols: ['http/1.1'], checkServerIdentity: (_name, certificate) => tls.checkServerIdentity(hostname, certificate) });
  const cancel = () => socket.destroy(new AuditSendFailure({ kind: 'cancelled' }));
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject);
      socket.once('close', () => reject(new AuditSendFailure({ kind: 'transient_failure', reason: 'transport' })));
      socket.once('secureConnect', () => {
        if (!socket.authorized) return reject(new AuditSendFailure({ kind: 'permanent_failure', reason: 'tls' }));
        if (!sameAuditAddress(address.address, socket.remoteAddress)) return reject(new AuditSendFailure({ kind: 'permanent_failure', reason: 'unsafe_destination' }));
        resolve();
      });
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    });
    signal.throwIfAborted();
    return socket;
  } catch (error) {
    await closeAuditSocket(socket);
    throw error;
  } finally { signal.removeEventListener('abort', cancel); }
}
