import { fromJsonSchema } from '@modelcontextprotocol/server';
import { FETCH_URL_MAX_CODE_POINTS, isValidFetchUrl } from '../../pipelines/page-fetch/fetch-url.ts';

export const fetchToolInputSchema = {
  type: 'object' as const,
  properties: {
    url: { type: 'string', minLength: 1, maxLength: FETCH_URL_MAX_CODE_POINTS, description: 'An absolute HTTP or HTTPS URL without user information.' },
    reason: { type: 'string', minLength: 1, maxLength: 2_000, pattern: '\\S', description: 'Why the agent needs this page.' },
  },
  required: ['url', 'reason'],
  additionalProperties: false,
};

const argumentValidator = fromJsonSchema<{ url: string; reason: string }>(fetchToolInputSchema);

export async function parseFetchToolArguments(value: unknown): Promise<{ url: string; reason: string } | undefined> {
  const parsed = await argumentValidator['~standard'].validate(value);
  if (parsed.issues !== undefined || !isValidFetchUrl(parsed.value.url)) return undefined;
  return parsed.value;
}

export function fieldStatus(value: unknown, bounds: { minLength: number; maxLength: number }): 'valid' | 'missing' | 'not_string' | 'empty' | 'too_long' {
  if (value === undefined) return 'missing';
  if (typeof value !== 'string') return 'not_string';
  let length = 0;
  for (const _point of value) {
    length += 1;
    if (length > bounds.maxLength) return 'too_long';
  }
  return length < bounds.minLength ? 'empty' : 'valid';
}
