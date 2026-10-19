import fs from 'node:fs';
import { join } from 'node:path';
import { CommandError } from '../shared/repository.ts';
import { rawFingerprintOf, writeCaptureManifest, type CaptureManifest } from './manifest.ts';

export function retainCapture(root: string, raw: string, capture: { manifest: CaptureManifest; verify: () => void }) {
  const parent = join(root, 'ast-report/coverage-captures');
  fs.mkdirSync(parent, { recursive: true });
  const folder = fs.mkdtempSync(join(parent, 'capture-'));
  try {
    fs.cpSync(raw, folder, { recursive: true });
    if (rawFingerprintOf(raw) !== capture.manifest.rawFingerprint || rawFingerprintOf(folder) !== capture.manifest.rawFingerprint) throw new CommandError('Raw V8 data changed during capture.');
    const provenance = writeCaptureManifest(folder, capture.manifest);
    capture.verify();
    return { folder, provenance };
  } catch (error) { fs.rmSync(folder, { recursive: true, force: true }); throw error; }
}
