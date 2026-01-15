import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ServerConfig } from '../types.js';

/**
 * Create and start a stdio transport for the MCP server
 *
 * @param server - The MCP server instance
 * @param _config - Server configuration (unused for stdio)
 * @returns Promise that resolves when the transport is connected
 */
export async function createStdioTransport(
  server: Server,
  _config: ServerConfig
): Promise<void> {
  const transport = new StdioServerTransport();

  // Handle process signals for graceful shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });

  await server.connect(transport);
}
