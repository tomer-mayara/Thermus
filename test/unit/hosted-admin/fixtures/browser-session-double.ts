import type { BrowserSession, BrowserSessionState } from '../../../../src/hosted-admin/browser-session.ts';

export type ConfiguredSession = BrowserSessionState | Error | (() => Promise<BrowserSessionState>);

// Gives the configured session state for the Cookie header of a request, and the other state for any other request.
// It stands in for a hosted provider: only its own session lookup can give a user.
export class BrowserSessionDouble implements BrowserSession {
  readonly calls: Request[] = [];
  private readonly sessions: ReadonlyMap<string, ConfiguredSession>;
  private readonly other: BrowserSessionState;

  constructor(sessions: ReadonlyMap<string, ConfiguredSession> = new Map(), other: BrowserSessionState = { status: 'signed-out' }) {
    this.sessions = sessions;
    this.other = other;
  }

  async authenticate(request: Request): Promise<BrowserSessionState> {
    this.calls.push(request);
    const configured = this.sessions.get(request.headers.get('Cookie') ?? '') ?? this.other;
    if (configured instanceof Error) throw configured;
    if (typeof configured === 'function') return configured();
    return configured;
  }
}
