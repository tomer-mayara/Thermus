import { Pool } from 'pg';
import type { PoolConfig } from 'pg';

export interface SqlBounds {
  active: number;
  pending: number;
  acquisitionMs: number;
  operationMs: number;
  statementMs: number;
  idleMs: number;
  closeMs: number;
}

const defaults: SqlBounds = { active: 2, pending: 4, acquisitionMs: 1000, operationMs: 2000, statementMs: 1500, idleMs: 10000, closeMs: 1500 };

export interface SettingsSqlOptions {
  connectionString: string;
  ca?: string;
  bounds?: Partial<SqlBounds>;
}

interface SqlClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(destroy?: boolean): void;
}

interface SqlPool {
  connect(): Promise<SqlClient>;
  end(): Promise<void>;
  on(event: 'error', listener: (error: Error) => void): unknown;
}

export interface SettingsSqlSession {
  query(text: string, values?: unknown[], write?: boolean): Promise<Record<string, unknown>[]>;
}

export type SqlResult<T> = { status: 'complete'; value: T } | { status: 'unavailable' | 'unconfirmed' };

interface Work {
  expired: boolean;
  wrote: boolean;
  client?: SqlClient;
  finish(): void;
  expire(): void;
}

/** Owns admitted work until its underlying acquisition or query settles. */
export class BoundedSqlRuntime {
  private readonly bounds: SqlBounds;
  private readonly work = new Set<Work>();
  private readonly pending: (() => void)[] = [];
  private closing?: Promise<void>;

  private readonly pool: SqlPool;

  constructor(pool: SqlPool, bounds: Partial<SqlBounds> = {}) {
    this.pool = pool;
    this.bounds = { ...defaults, ...bounds };
    validateBounds(this.bounds);
    pool.on('error', () => {});
  }

  run<T>(operation: (session: SettingsSqlSession) => Promise<T>): Promise<SqlResult<T>> {
    if (this.closing || this.work.size >= this.bounds.active + this.bounds.pending) return Promise.resolve({ status: 'unavailable' });
    return new Promise((resolve) => {
      const item: Work = { expired: false, wrote: false, finish: () => {}, expire: () => {} };
      item.expire = () => {
        item.finish();
        item.expired = true;
        resolve({ status: item.wrote ? 'unconfirmed' : 'unavailable' });
        this.destroy(item);
      };
      const timer = setTimeout(item.expire, this.bounds.operationMs);
      item.finish = () => { clearTimeout(timer); };
      const start = () => { void this.execute(item, operation, resolve); };
      this.work.add(item);
      if (this.work.size <= this.bounds.active) start();
      else this.pending.push(start);
    });
  }

  close(): Promise<void> {
    this.closing ??= this.dispose();
    return this.closing;
  }

  private async execute<T>(item: Work, operation: (session: SettingsSqlSession) => Promise<T>, resolve: (result: SqlResult<T>) => void): Promise<void> {
    try {
      if (item.expired) return;
      const acquisition = setTimeout(item.expire, this.bounds.acquisitionMs);
      const finish = item.finish;
      item.finish = () => { finish(); clearTimeout(acquisition); };
      try { item.client = await this.pool.connect(); } finally { clearTimeout(acquisition); }
      if (item.expired) return;
      const client = item.client;
      const value = await operation(this.session(item, client));
      if (!item.expired) resolve({ status: 'complete', value });
    } catch {
      if (!item.expired) resolve({ status: item.wrote ? 'unconfirmed' : 'unavailable' });
      item.expired = true;
    } finally {
      item.finish();
      item.client?.release(item.expired);
      this.work.delete(item);
      this.pending.shift()?.();
    }
  }

  private session(item: Work, client: SqlClient): SettingsSqlSession {
    return { query: async (text, values, write) => {
      if (item.expired) throw new Error('Storage operation ended');
      item.wrote ||= Boolean(write);
      return (await client.query(text, values)).rows;
    } };
  }

  private destroy(item: Work): void {
    if (!item.client) return;
    const client = item.client;
    item.client = undefined;
    client.release(true);
  }

  private async dispose(): Promise<void> {
    for (const item of this.work) {
      item.expire();
    }
    const end = this.pool.end().catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([end, new Promise<void>((resolve) => { timer = setTimeout(resolve, this.bounds.closeMs); })]);
    clearTimeout(timer);
  }
}

function validateBounds(bounds: SqlBounds): void {
  for (const [name, value] of Object.entries(bounds)) {
    if (!Number.isSafeInteger(value) || value < (name === 'pending' ? 0 : 1)) throw new Error('Invalid SQL runtime bounds');
  }
}

export function createPgSettingsRuntime(options: SettingsSqlOptions): BoundedSqlRuntime {
  const bounds = { ...defaults, ...options.bounds };
  validateBounds(bounds);
  const connection = connectionOptions(options.connectionString);
  const pool = new Pool({
    ...connection,
    ssl: { rejectUnauthorized: true, ...(options.ca ? { ca: options.ca } : {}) },
    max: bounds.active,
    connectionTimeoutMillis: bounds.acquisitionMs,
    idleTimeoutMillis: bounds.idleMs,
    statement_timeout: bounds.statementMs,
    query_timeout: bounds.operationMs,
    application_name: 'thermus-settings',
  });
  return new BoundedSqlRuntime(pool, bounds);
}

function connectionOptions(connectionString: string): PoolConfig {
  try {
    const url = new URL(connectionString);
    const host = decodeURIComponent(url.hostname).replace(/^\[|\]$/g, '');
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const database = decodeURIComponent(url.pathname.slice(1));
    const missing = [host, user, password, database].some((part) => !part.trim());
    const invalid = missing || host.includes('/') || /[?#\s\p{Cc}]/u.test(connectionString) || !['postgres:', 'postgresql:'].includes(url.protocol);
    if (invalid) throw new Error();
    const pinned: PoolConfig = { host, user, password, database, port: Number(url.port || 5432), sslnegotiation: 'postgres', options: ' ', client_encoding: 'UTF8' };
    return pinned;
  } catch {
    throw new Error('Invalid database connection configuration');
  }
}
