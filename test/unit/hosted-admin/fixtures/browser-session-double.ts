import type { BrowserSession, BrowserSessionState } from '../../../../src/hosted-admin/browser-session.ts';

export type ConfiguredSession = BrowserSessionState | Error | (() => Promise<BrowserSessionState>);

export class BrowserSessionDouble implements BrowserSession {
  readonly calls: (string | null)[] = [];
  private readonly sessions: ReadonlyMap<string, ConfiguredSession>;
  private readonly other: BrowserSessionState;

  constructor(sessions: ReadonlyMap<string, ConfiguredSession> = new Map(), other: BrowserSessionState = { status: 'signed-out' }) {
    this.sessions = sessions;
    this.other = other;
  }

  async authenticate(cookieHeader: string | null): Promise<BrowserSessionState> {
    this.calls.push(cookieHeader);
    const configured = this.sessions.get(cookieHeader ?? '') ?? this.other;
    if (configured instanceof Error) throw configured;
    if (typeof configured === 'function') return configured();
    return configured;
  }
}
