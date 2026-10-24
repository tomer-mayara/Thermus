export interface ExecutionContext {
    readonly signal: AbortSignal;
    readonly operationId: string;
}
export declare function assertOperationId(value: unknown): void;
