import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

type Environment = Readonly<Record<string, string | undefined>>;

// Each message names the setting and the rule. It does not show the path or the file contents, because they can be private.
export class AdRulesFileError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AdRulesFileError';
  }
}

// Only the server reads AD_RULES_FILE. The local commands share loadDeploymentConfig and do not need ad rules.
// The operator supplies a trusted file, so there is no size limit. There is no syntax check,
// because the native parser ignores the lines that it cannot parse.
export function readAdRulesFile(environment: Environment): string {
  const file = environment.AD_RULES_FILE;
  if (file === undefined || file === '') {
    throw new AdRulesFileError('AD_RULES_FILE is required. Set it to the absolute path of a trusted ad rules file.');
  }
  if (!isAbsolute(file)) throw new AdRulesFileError('AD_RULES_FILE must be an absolute path.');
  return decodeUtf8(readBytes(file));
}

// One read and no check before it, so the file cannot change between a check and the read.
function readBytes(file: string): Uint8Array {
  try {
    return readFileSync(file);
  } catch (cause) {
    throw new AdRulesFileError(`AD_RULES_FILE could not be read (${errorCode(cause)}).`, { cause });
  }
}

// The decoder removes one byte order mark at the start of the text.
function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new AdRulesFileError('AD_RULES_FILE must contain UTF-8 text.', { cause });
  }
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') return error.code;
  return 'unknown error';
}
