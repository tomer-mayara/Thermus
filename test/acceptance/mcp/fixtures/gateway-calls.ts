import { gatewayOrganization } from '../../../support/in-process/hosted-gateway-site.ts';

// The tool calls of the gateway specifications, and the answers of the fake tenant upstream and of the gateway to them.

export const sourceUrl = 'https://source.example/story';
export const fetchCall = { name: 'getURLAsMarkdown', arguments: { url: sourceUrl, reason: 'Read the source' } };
export const tenantMarkdown = `Markdown of ${sourceUrl} from the tenant of ${gatewayOrganization}`;
export const restartedWords = 'Server restarted. Try again in a minute.';
export const busyWords = 'Server busy. Try again later.';

export function searchCall(query: string) {
  return { name: 'search', arguments: { query, reason: 'Find the source' } };
}
