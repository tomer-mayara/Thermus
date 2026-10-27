export interface SqlBounds {
    active: number;
    pending: number;
    acquisitionMs: number;
    operationMs: number;
    statementMs: number;
    idleMs: number;
    closeMs: number;
}
export interface SettingsSqlOptions {
    connectionString: string;
    ca?: string;
    bounds?: Partial<SqlBounds>;
}
interface SqlClient {
    query(text: string, values?: unknown[]): Promise<{
        rows: Record<string, unknown>[];
    }>;
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
export type SqlResult<T> = {
    status: 'complete';
    value: T;
} | {
    status: 'unavailable' | 'unconfirmed';
};
export declare class BoundedSqlRuntime {
    private readonly bounds;
    private readonly work;
    private readonly pending;
    private closing?;
    private readonly pool;
    constructor(pool: SqlPool, bounds?: Partial<SqlBounds>);
    run<T>(operation: (session: SettingsSqlSession) => Promise<T>): Promise<SqlResult<T>>;
    close(): Promise<void>;
    private execute;
    private session;
    private destroy;
    private dispose;
}
export declare function createPgSettingsRuntime(options: SettingsSqlOptions): BoundedSqlRuntime;
export {};
