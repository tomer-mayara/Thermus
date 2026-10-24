import type { ApplicationLogger } from './application.ts';
import { type ToolOperations } from '../interfaces/mcp/fetch-tool-server.ts';
import type { RequestServerBuilder } from '../interfaces/mcp/mcp-server.ts';
type Environment = Readonly<Record<string, string | undefined>>;
export type { ToolOperations } from '../interfaces/mcp/fetch-tool-server.ts';
export declare function createToolOperations(environment: Environment, logger: ApplicationLogger): ToolOperations;
export declare function createHostedToolOperations(environment: Environment, logger: ApplicationLogger): ToolOperations;
export declare function fetchToolServers(operations: ToolOperations, logger: ApplicationLogger): RequestServerBuilder;
