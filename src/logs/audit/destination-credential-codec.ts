import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export class DestinationCredentialCodec {
  private readonly key: Buffer;

  constructor(key: Uint8Array) {
    if (key.length !== 32) throw new Error('Destination encryption key is unavailable.');
    this.key = Buffer.from(key);
  }

  encrypt(tenantId: string, token: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    cipher.setAAD(Buffer.from(tenantId, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64');
  }

  decrypt(tenantId: string, value: string): string | null {
    try {
      const bytes = Buffer.from(value, 'base64');
      if (bytes.length <= 28 || bytes.toString('base64') !== value) return null;
      const decipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12));
      decipher.setAAD(Buffer.from(tenantId, 'utf8'));
      decipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }
}
