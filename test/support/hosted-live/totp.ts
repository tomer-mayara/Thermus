import { createHmac } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const stepMilliseconds = 30_000;
// A code sent at the end of its step can reach WorkOS in the next step, where a later code would count as a reuse.
const lastSafeMillisecond = 27_000;
const stepStartMargin = 250;

function base32Bytes(text: string): Buffer {
  let bits = '';
  for (const character of text.replace(/=+$/, '')) {
    const value = base32Alphabet.indexOf(character);
    if (value < 0) throw new Error('The MFA setup key is not base32.');
    bits += value.toString(2).padStart(5, '0');
  }
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)));
}

function hotp(key: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(message).digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

// The authenticator app of one user: RFC 6238 with SHA-1, 6 digits, and 30-second steps.
// WorkOS accepts each code one time, so the app never gives two codes of the same step.
export class TotpAuthenticator {
  #key: Buffer | undefined;
  #lastStep = -1;

  get enrolled(): boolean {
    return this.#key !== undefined;
  }

  enroll(setupKey: string): void {
    this.#key = base32Bytes(setupKey);
    this.#lastStep = -1;
  }

  async nextCode(): Promise<string> {
    if (this.#key === undefined) throw new Error('The user has no MFA setup key in this run: AuthKit did not show the MFA enrollment.');
    const now = Date.now();
    const late = now % stepMilliseconds >= lastSafeMillisecond ? 1 : 0;
    const step = Math.max(Math.floor(now / stepMilliseconds) + late, this.#lastStep + 1);
    await sleep(Math.max(0, step * stepMilliseconds + stepStartMargin - now));
    this.#lastStep = step;
    return hotp(this.#key, step);
  }
}
