import express, { type Request, type Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ServerConfig } from '../types.js';
import { toolDefinitions } from '../tools/index.js';

/**
 * Create and start an HTTP transport for the MCP server
 *
 * This provides a REST API endpoint for tools in addition to MCP protocol.
 * Useful for debugging and direct HTTP integrations.
 *
 * @param _server - The MCP server instance (for future SSE streaming support)
 * @param config - Server configuration
 * @returns Promise that resolves when the HTTP server is listening
 */
export async function createHttpTransport(
  _server: Server,
  config: ServerConfig
): Promise<void> {
  const app = express();
  app.use(express.json());

  const port = config.port ?? 3000;
  const host = config.host ?? '127.0.0.1';

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      data: {
        status: 'healthy',
        version: '1.0.0',
        tools: toolDefinitions.map((t) => t.name),
      },
      meta: {
        retrieved_at: new Date().toISOString(),
      },
    });
  });

  // List available tools
  app.get('/tools', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      data: {
        tools: toolDefinitions.map((t) => ({
          name: t.name,
          description: t.description,
        })),
      },
      meta: {
        retrieved_at: new Date().toISOString(),
      },
    });
  });

  // Tool execution endpoint
  app.post('/tools/:toolName', async (req: Request, res: Response) => {
    const { toolName } = req.params;
    const tool = toolDefinitions.find((t) => t.name === toolName);

    if (!tool) {
      res.status(404).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: `Tool "${toolName}" not found`,
          details: {
            available_tools: toolDefinitions.map((t) => t.name),
          },
        },
        meta: {
          retrieved_at: new Date().toISOString(),
        },
      });
      return;
    }

    try {
      const result = await tool.handler(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? { stack: error.stack } : {},
        },
        meta: {
          retrieved_at: new Date().toISOString(),
        },
      });
    }
  });

  // Start HTTP server
  return new Promise((resolve) => {
    const httpServer = app.listen(port, host, () => {
      console.error(`[license-check] HTTP server listening on http://${host}:${port}`);
      console.error(`[license-check] Available endpoints:`);
      console.error(`  GET  /health - Health check`);
      console.error(`  GET  /tools - List available tools`);
      console.error(`  POST /tools/:toolName - Execute a tool`);
      resolve();
    });

    // Handle process signals for graceful shutdown
    process.on('SIGINT', () => {
      httpServer.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      httpServer.close();
      process.exit(0);
    });
  });
}
