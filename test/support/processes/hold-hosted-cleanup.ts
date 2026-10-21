import { MCPServer } from '../../../src/interfaces/mcp/mcp-server.ts';

// Cleanup can stop making progress after listener drain. The CLI must keep its deadline alive until cleanup ends.
MCPServer.prototype.close = () => new Promise(() => {});
