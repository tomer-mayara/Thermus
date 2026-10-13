import {
  bearerAuthChallengeResponse,
  createMcpHandler,
  McpServer,
  OAuthError,
  OAuthErrorCode,
  requireBearerAuth,
  type AuthInfo,
  type Transport,
} from '@modelcontextprotocol/server';
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';

import type { AccessResolver, RequestContext } from '../auth/access-context.ts';
import type { IdentityVerifier } from './identity-verifier.ts';
import { IdentityVerifierSdkAdapter, verifiedUserOf } from './identity-verifier-sdk-adapter.ts';

export type RequestToolRegistration = (server: McpServer, context: RequestContext) => void;

export type FailureStep = 'token-verification' | 'access-resolution';

export interface FailureReport {
  readonly step: FailureStep;
  readonly cause: unknown;
}

export type FailureReporter = (report: FailureReport) => void;

export interface McpHttpAuthOptions {
  verifier: IdentityVerifier;
  accessResolver: AccessResolver;
  resourceMetadataUrl: string;
  expectedResource: URL;
  requiredScopes?: readonly string[];
}

type BearerGate = (request: Request) => Promise<AuthInfo | Response>;

export class MCPServer {
  private connection?: StdioServerHandle;
  private readonly contextsByRequestAuth = new WeakMap<AuthInfo, RequestContext>();
  private readonly httpHandler = createMcpHandler(({ authInfo }) => this.serverForRequest(authInfo));
  private readonly http?: { authenticate: BearerGate; accessResolver: AccessResolver };
  private readonly registerTools?: RequestToolRegistration;

  constructor(options?: { auth: McpHttpAuthOptions; registerTools?: RequestToolRegistration; reportFailure: FailureReporter }) {
    if (options !== undefined) {
      this.http = { authenticate: bearerGate(options.auth), accessResolver: options.auth.accessResolver };
      this.registerTools = options.registerTools;
    }
  }

  connect(transport: Transport): void {
    this.connection = serveStdio(() => serverWithoutTools(), { transport });
  }

  async fetch(request: Request): Promise<Response> {
    if (this.http === undefined) {
      throw new Error('HTTP authentication must be configured before serving requests');
    }
    const authInfo = await this.http.authenticate(request);
    if (authInfo instanceof Response) return authInfo;
    const context = await resolveRequestContext(this.http.accessResolver, authInfo);
    if (context instanceof Response) return context;
    return this.httpHandler.fetch(request, { authInfo: this.newRequestAuthBoundTo(context, authInfo) });
  }

  async close(): Promise<void> {
    await Promise.all([this.httpHandler.close(), this.connection?.close()]);
  }

  private newRequestAuthBoundTo(context: RequestContext, authInfo: AuthInfo): AuthInfo {
    const requestAuth = { ...authInfo };
    this.contextsByRequestAuth.set(requestAuth, context);
    return requestAuth;
  }

  private serverForRequest(authInfo: AuthInfo | undefined): McpServer {
    const context = authInfo === undefined ? undefined : this.contextsByRequestAuth.get(authInfo);
    if (context === undefined) throw new Error('The MCP request has no trusted access context');
    const server = serverWithoutTools();
    this.registerTools?.(server, context);
    return server;
  }
}

function serverWithoutTools(): McpServer {
  return new McpServer({ name: 'magumagu', version: '0.0.0' });
}

function bearerGate(auth: McpHttpAuthOptions): BearerGate {
  const options = {
    verifier: new IdentityVerifierSdkAdapter(auth.verifier),
    resourceMetadataUrl: auth.resourceMetadataUrl,
    expectedResource: auth.expectedResource,
    requiredScopes: auth.requiredScopes === undefined ? undefined : [...auth.requiredScopes],
  };
  const authenticate = requireBearerAuth(options);
  return async (request) => {
    const authorization = request.headers.get('Authorization');
    if (authorization !== null && !/^Bearer [^\s,]+$/i.test(authorization)) {
      return bearerAuthChallengeResponse(
        new OAuthError(OAuthErrorCode.InvalidToken, "Invalid Authorization header format, expected 'Bearer TOKEN'"),
        options,
      );
    }
    return authenticate(request);
  };
}

async function resolveRequestContext(resolver: AccessResolver, authInfo: AuthInfo): Promise<RequestContext | Response> {
  try {
    const decision = await resolver.resolve(verifiedUserOf(authInfo));
    if (decision.allowed !== true) return errorResponse(OAuthErrorCode.AccessDenied, 'Access denied', 403);
    return requireTrustedTenant(frozenCopy(decision.context));
  } catch {
    return errorResponse(OAuthErrorCode.ServerError, 'Internal Server Error', 500);
  }
}

function requireTrustedTenant(context: RequestContext): RequestContext {
  if (typeof context.tenantId !== 'string' || context.tenantId === '') {
    throw new Error('The access decision has no trusted tenant');
  }
  return context;
}

function frozenCopy<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function errorResponse(code: OAuthErrorCode, description: string, status: number): Response {
  return Response.json(new OAuthError(code, description).toResponseObject(), { status });
}
