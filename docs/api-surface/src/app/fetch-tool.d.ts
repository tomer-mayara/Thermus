import type { AuditLog } from '../logs/audit/audit-log.ts';
import type { SystemLog } from '../logs/system/system-logger.ts';
import { type ToolOperations } from '../interfaces/mcp/fetch-tool-server.ts';
import type { RequestServerBuilder } from '../interfaces/mcp/mcp-server.ts';
type Environment = Readonly<Record<string, string | undefined>>;
export type { ToolOperations } from '../interfaces/mcp/fetch-tool-server.ts';
export declare function createToolOperations(environment: Environment, logger: SystemLog): ToolOperations;
export declare function createHostedToolOperations(environment: Environment, logger: SystemLog): ToolOperations;
export declare function fetchToolServers(operations: ToolOperations, logger: SystemLog, audit?: Pick<AuditLog, 'toolCompleted'>): RequestServerBuilder;
