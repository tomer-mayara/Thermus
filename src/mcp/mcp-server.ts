import {
  bearerAuthChallengeResponse,
  createMcpHandler,
  McpServer,
  OAuthError,
  OAuthErrorCode,
  requireBearerAuth,
  type AuthInfo,
  type Transport,
  type Server,
} from '@modelcontextprotocol/server';
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';

import { waitForRequest } from '../http/request-cancellation.ts';
import type { AccessResolver, RequestContext } from '../auth/access-context.ts';
import type { IdentityVerifier } from '../auth/identity-verifier.ts';
import { IdentityVerifierSdkAdapter, verifiedUserOf } from './identity-verifier-sdk-adapter.ts';

export interface McpRequestLifetime {
  readonly signal: AbortSignal;
  // Track the full handler, including its cancellation result and cleanup.
  track<T>(task: Promise<T>): Promise<T>;
}

export type RequestServerBuilder = (context: RequestContext, lifetime: McpRequestLifetime) => Server | McpServer;

export interface FailureReport {
  readonly step: 'token-verification' | 'access-resolution';
  readonly cause: unknown;
}

export type FailureReporter = (report: FailureReport) => void;

export interface McpHttpAuthOptions {
  verifier: IdentityVerifier;
  accessResolver: AccessResolver;
  resourceMetadataUrl: string;
  expectedResource: URL;
  requiredScopes?: readonly string[];
  // Each MCP request needs this application permission, such as product:access. An allowed context without it gets
  // the answer of a denial. Without this option, each allowed context is enough.
  requiredPermission?: string;
  accessDeniedDescription?: string;
}

type BearerGate = (request: Request) => Promise<AuthInfo | Response>;
type AccessGate = (authInfo: AuthInfo) => Promise<RequestContext | Response>;

export class MCPServer {
  private connection?: StdioServerHandle;
  private closing?: Promise<void>;
  private readonly shutdown = new AbortController();
  private readonly requests = new Set<Promise<unknown>>();
  private readonly tasks = new Set<Promise<unknown>>();
  private readonly cleanup = new Set<Promise<unknown>>();
  private readonly ownedCloses = new Set<() => Promise<void>>();
  private readonly cleanupErrors = new Set<unknown>();
  private readonly contextsByRequestAuth = new WeakMap<AuthInfo, { context: RequestContext; lifetime: McpRequestLifetime }>();
  private readonly httpHandler = createMcpHandler(({ authInfo }) => this.serverForRequest(authInfo));
  private readonly http?: { authenticate: BearerGate; resolveAccess: AccessGate };
  private readonly buildServer?: RequestServerBuilder;

  constructor(options?: {
    auth: McpHttpAuthOptions;
    buildServer?: RequestServerBuilder;
    reportFailure: FailureReporter;
  }) {
    if (options !== undefined) {
      const { auth, reportFailure } = options;
      this.http = {
        authenticate: bearerGate(auth, reportFailure),
        resolveAccess: accessGate(auth, reportFailure),
      };
      this.buildServer = options.buildServer;
    }
  }

  connect(transport: Transport): void {
    this.requireOpen();
    if (this.connection !== undefined) throw new Error('The MCP server already has a transport');
    // A duplex transport can call its peer back during close. Keep its own reentry guard.
    const close = transport.close.bind(transport);
    transport.close = () => this.track(this.cleanup, close().catch((error) => {
      this.cleanupErrors.add(error);
      throw error;
    }));
    this.connection = serveStdio(() => serverWithoutTools(), { transport });
  }

  async fetch(request: Request): Promise<Response> {
    this.requireOpen();
    return this.track(this.requests, Promise.resolve().then(() => this.serveRequest(request)));
  }

  private async serveRequest(request: Request): Promise<Response> {
    this.requireOpen();
    const http = this.http;
    if (http === undefined) {
      throw new Error('HTTP authentication must be configured before serving requests');
    }
    const signal = AbortSignal.any([request.signal, this.shutdown.signal]);
    const authInfo = await waitForRequest(signal, () => http.authenticate(request));
    signal.throwIfAborted();
    if (authInfo instanceof Response) return authInfo;
    const context = await waitForRequest(signal, () => http.resolveAccess(authInfo));
    signal.throwIfAborted();
    if (context instanceof Response) return context;
    const lifetime: McpRequestLifetime = Object.freeze({ signal, track: <T>(task: Promise<T>) => this.track(this.tasks, task) });
    return this.dispatchRequest(request, this.newRequestAuthBoundTo(context, authInfo, lifetime), signal);
  }

  private async dispatchRequest(request: Request, authInfo: AuthInfo, signal: AbortSignal): Promise<Response> {
    // The SDK bounds and parses the body, but its reader does not observe abort.
    const finishedReading = new AbortController();
    const bodySignal = AbortSignal.any([signal, finishedReading.signal]);
    const transfer = request.body === null ? undefined : new TransformStream<Uint8Array, Uint8Array>();
    const transferred = transfer === undefined ? undefined : request.body?.pipeTo(transfer.writable, { signal: bodySignal }).catch((error) => {
      if (bodySignal.aborted && error !== bodySignal.reason) this.cleanupErrors.add(error);
    });
    try {
      const boundRequest = new Request(request, { signal, ...(transfer === undefined ? {} : { body: transfer.readable, duplex: 'half' }) } as RequestInit);
      return await this.httpHandler.fetch(boundRequest, { authInfo });
    } finally {
      finishedReading.abort();
      await transferred;
    }
  }

  close(): Promise<void> {
    if (this.closing !== undefined) return this.closing;
    const closing = Promise.withResolvers<void>();
    this.closing = closing.promise;
    void this.closeOwnedWork().then(closing.resolve, closing.reject);
    return this.closing;
  }

  private async closeOwnedWork(): Promise<void> {
    this.shutdown.abort(new DOMException('The MCP server is shutting down', 'AbortError'));
    const results = await Promise.allSettled([
      this.httpHandler.close(), this.connection?.close(),
      ...[...this.ownedCloses].map((close) => close()),
      this.drainWork(),
    ]);
    for (const result of results) if (result.status === 'rejected') this.cleanupErrors.add(result.reason);
    if (this.cleanupErrors.size === 1) throw [...this.cleanupErrors][0];
    if (this.cleanupErrors.size > 1) throw new AggregateError(this.cleanupErrors, 'MCP cleanup failed');
  }

  private async drainWork(): Promise<void> {
    while (this.requests.size > 0 || this.tasks.size > 0 || this.cleanup.size > 0) {
      const [tasks] = await Promise.all([
        Promise.allSettled([...this.tasks]),
        Promise.allSettled([...this.requests]),
        Promise.allSettled([...this.cleanup]),
      ]);
      for (const task of tasks) if (task.status === 'rejected') this.cleanupErrors.add(task.reason);
    }
  }

  private track<T>(active: Set<Promise<unknown>>, task: Promise<T>): Promise<T> {
    active.add(task);
    void task.then(() => active.delete(task), () => active.delete(task));
    return task;
  }

  private ownClose(resource: { close(): Promise<void> }): void {
    const original = resource.close.bind(resource);
    let closing: Promise<void> | undefined;
    const close = () => closing ??= this.track(this.cleanup, Promise.resolve().then(original).catch((error) => {
      this.cleanupErrors.add(error);
      throw error;
    }).finally(() => this.ownedCloses.delete(close)));
    resource.close = close;
    this.ownedCloses.add(close);
  }

  private requireOpen(): void {
    if (this.shutdown.signal.aborted) throw new Error('The MCP server is closed');
  }

  private newRequestAuthBoundTo(context: RequestContext, authInfo: AuthInfo, lifetime: McpRequestLifetime): AuthInfo {
    const requestAuth = { ...authInfo };
    this.contextsByRequestAuth.set(requestAuth, { context, lifetime });
    return requestAuth;
  }

  private serverForRequest(authInfo: AuthInfo | undefined): Server | McpServer {
    this.requireOpen();
    const bound = authInfo === undefined ? undefined : this.contextsByRequestAuth.get(authInfo);
    if (bound === undefined) throw new Error('The MCP request has no trusted access context');
    const product = this.buildServer?.(bound.context, bound.lifetime) ?? serverWithoutTools();
    const server = product instanceof McpServer ? product.server : product;
    this.ownClose(server);
    const onclose = server.onclose;
    server.onclose = () => {
      void server.close();
      onclose?.();
    };
    const connect = server.connect.bind(server);
    server.connect = (transport) => {
      this.requireOpen();
      this.ownClose(transport);
      return connect(transport);
    };
    return product;
  }
}

function serverWithoutTools(): McpServer {
  return new McpServer({ name: 'thermus', version: '0.0.0' });
}

function bearerGate(auth: McpHttpAuthOptions, reportFailure: FailureReporter): BearerGate {
  const options = {
    verifier: new IdentityVerifierSdkAdapter(auth.verifier, (cause) => reportFailure({ step: 'token-verification', cause })),
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

function accessGate(auth: Pick<McpHttpAuthOptions, 'accessResolver' | 'requiredPermission' | 'accessDeniedDescription'>, reportFailure: FailureReporter): AccessGate {
  const { accessResolver, requiredPermission, accessDeniedDescription = 'Access denied' } = auth;
  return async (authInfo) => {
    try {
      const decision = await accessResolver.resolve(verifiedUserOf(authInfo));
      if (decision.allowed !== true) return accessDenied(accessDeniedDescription);
      const context = requireTrustedTenant(frozenCopy(decision.context));
      if (requiredPermission !== undefined && !context.permissions.includes(requiredPermission)) return accessDenied(accessDeniedDescription);
      return context;
    } catch (cause) {
      reportFailure({ step: 'access-resolution', cause });
      return errorResponse(OAuthErrorCode.ServerError, 'Internal Server Error', 500);
    }
  };
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

function accessDenied(description: string): Response {
  return errorResponse(OAuthErrorCode.AccessDenied, description, 403);
}

function errorResponse(code: OAuthErrorCode, description: string, status: number): Response {
  return Response.json(new OAuthError(code, description).toResponseObject(), { status });
}
