import type { AuthenticatedUser } from '../../../../src/auth/access-context.ts';
import type {
  BrowserSession,
  BrowserSessionState,
  CookieEffects,
  OrganizationSwitch,
  SignedInBrowserSession,
} from '../../../../src/hosted-admin/browser-session.ts';

export type ConfiguredSession = BrowserSessionState | Error | (() => Promise<BrowserSessionState>);
export type ConfiguredSwitch = OrganizationSwitch | Error;

export interface SignedInSetup {
  readonly csrfToken?: string;
  readonly mfaCompleted?: boolean;
  readonly cookies?: CookieEffects;
  readonly switchTo?: ConfiguredSwitch;
}

export class BrowserSessionDouble implements BrowserSession {
  readonly calls: (string | null)[] = [];
  private readonly sessions: ReadonlyMap<string, ConfiguredSession>;
  private readonly other: BrowserSessionState;

  constructor(sessions: ReadonlyMap<string, ConfiguredSession> = new Map(), other: BrowserSessionState = { status: 'signed-out', cookies: [] }) {
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

export class SignedInSessionDouble implements SignedInBrowserSession {
  readonly status = 'signed-in';
  readonly switches: string[] = [];
  readonly user: AuthenticatedUser;
  readonly csrfToken: string;
  readonly mfaCompleted: boolean;
  readonly cookies: CookieEffects;
  private readonly switchTo: ConfiguredSwitch;

  constructor(user: AuthenticatedUser, setup: SignedInSetup = {}) {
    this.user = user;
    this.csrfToken = setup.csrfToken ?? `csrf-token-of-${user.subject}`;
    this.mfaCompleted = setup.mfaCompleted ?? true;
    this.cookies = setup.cookies ?? [];
    this.switchTo = setup.switchTo ?? { status: 'switched', cookies: [] };
  }

  async selectOrganization(organizationId: string): Promise<OrganizationSwitch> {
    this.switches.push(organizationId);
    if (this.switchTo instanceof Error) throw this.switchTo;
    return this.switchTo;
  }
}
