import { fromJsonSchema } from '@modelcontextprotocol/server';
import { SearchQuery } from '../search-pipeline/search-query.ts';

export const searchToolInputSchema = {
  type: 'object' as const,
  properties: {
    query: { type: 'string', minLength: 1, maxLength: SearchQuery.MAX_SCALARS, pattern: '\\S', description: 'The web search query.' },
    reason: { type: 'string', minLength: 1, maxLength: 2_000, pattern: '\\S', description: 'Why the agent needs this search.' },
  },
  required: ['query', 'reason'],
  additionalProperties: false,
};

const argumentValidator = fromJsonSchema<{ query: string; reason: string }>(searchToolInputSchema);

export async function parseSearchToolArguments(value: unknown): Promise<{ query: string; reason: string } | undefined> {
  const parsed = await argumentValidator['~standard'].validate(value);
  if (parsed.issues !== undefined) return undefined;
  try {
    return { query: new SearchQuery(parsed.value.query).value, reason: parsed.value.reason };
  } catch {
    return undefined;
  }
}
