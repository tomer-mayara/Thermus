// A proof runs this script in a new Node process, because the provider reads NODE_ENV one time, when its modules load.
import { errorCodeOf, HttpAgent } from './better-auth-agents.ts';
import { startLocalProvider } from './better-auth-local.ts';

const credentials = { email: 'alice@example.com', password: 'alice-password-1' };
const outboundRequests: string[] = [];

globalThis.fetch = async (input) => {
  outboundRequests.push(input instanceof Request ? input.url : String(input));
  throw new Error('Outbound network access is not allowed in the local provider');
};

const { auth, database } = await startLocalProvider();
try {
  const { user } = await auth.api.createUser({ body: { ...credentials, name: credentials.email } });
  const response = await new HttpAgent(auth).request('POST', '/api/auth/sign-in/email', { origin: 'https://evil.example', json: credentials });
  const sessions = await (await auth.$context).internalAdapter.listSessions(user.id);
  process.stdout.write(JSON.stringify({ status: response.status, code: await errorCodeOf(response), sessions: sessions.length, outboundRequests }));
} finally {
  database.close();
}
