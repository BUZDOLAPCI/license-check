import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import type { ServerConfig } from '../types.js';
import { toolDefinitions } from '../tools/index.js';

const SERVER_VERSION = '1.0.0';

// Session storage for stateful MCP connections
const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: Server }>();

/**
 * Create and start an HTTP transport for the MCP server
 *
 * This provides MCP protocol support via StreamableHTTPServerTransport
 * using raw Node.js HTTP for compatibility with the MCP SDK.
 *
 * @param createServerFn - Function to create a new MCP server instance
 * @param config - Server configuration
 * @returns Promise that resolves when the HTTP server is listening
 */
export async function createHttpTransport(
  createServerFn: () => Server,
  config: ServerConfig
): Promise<void> {
  const port = config.port ?? 8080;
  const host = config.host ?? '127.0.0.1';

  const httpServer = createHttpServer();

  httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    switch (url.pathname) {
      case '/mcp':
        await handleMcpRequest(req, res, createServerFn);
        break;
      case '/health':
        handleHealthCheck(res);
        break;
      case '/tools':
        handleListTools(req, res);
        break;
      default:
        // Handle /tools/:toolName pattern
        if (url.pathname.startsWith('/tools/') && req.method === 'POST') {
          const toolName = url.pathname.slice('/tools/'.length);
          await handleToolExecution(req, res, toolName);
        } else {
          handleNotFound(res);
        }
    }
  });

  return new Promise((resolve) => {
    httpServer.listen(port, host, () => {
      console.error(`[license-check] HTTP server listening on http://${host}:${port}`);
      console.error(`[license-check] Available endpoints:`);
      console.error(`  POST /mcp - MCP protocol endpoint`);
      console.error(`  GET  /health - Health check`);
      console.error(`  GET  /tools - List available tools`);
      console.error(`  POST /tools/:toolName - Execute a tool`);
      resolve();
    });

    // Handle process signals for graceful shutdown
    process.on('SIGINT', () => {
      httpServer.close();
      // Clean up all sessions
      for (const [sessionId, session] of sessions) {
        session.transport.close();
        sessions.delete(sessionId);
      }
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      httpServer.close();
      // Clean up all sessions
      for (const [sessionId, session] of sessions) {
        session.transport.close();
        sessions.delete(sessionId);
      }
      process.exit(0);
    });
  });
}

/**
 * Handle MCP protocol requests via StreamableHTTPServerTransport
 */
async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  createServerFn: () => Server
): Promise<void> {
  // Get or create session
  const sessionId = (req.headers['mcp-session-id'] as string) || randomUUID();

  let session = sessions.get(sessionId);

  if (!session) {
    // Create new session with transport and server
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
    });

    const server = createServerFn();
    await server.connect(transport);

    session = { transport, server };
    sessions.set(sessionId, session);
  }

  // Handle the request using raw Node.js request/response objects
  // Note: No third argument - MCP SDK expects only (req, res)
  await session.transport.handleRequest(req, res);
}

/**
 * Handle health check requests
 */
function handleHealthCheck(res: ServerResponse): void {
  const response = {
    ok: true,
    data: {
      status: 'healthy',
      version: SERVER_VERSION,
      tools: toolDefinitions.map((t) => t.name),
    },
    meta: {
      retrieved_at: new Date().toISOString(),
    },
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}

/**
 * Handle list tools requests
 */
function handleListTools(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Method not allowed',
      },
      meta: { retrieved_at: new Date().toISOString() },
    }));
    return;
  }

  const response = {
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
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}

/**
 * Handle tool execution requests
 */
async function handleToolExecution(
  req: IncomingMessage,
  res: ServerResponse,
  toolName: string
): Promise<void> {
  const tool = toolDefinitions.find((t) => t.name === toolName);

  if (!tool) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
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
    }));
    return;
  }

  try {
    // Parse request body
    const body = await parseRequestBody(req);
    const result = await tool.handler(body);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? { stack: error.stack } : {},
      },
      meta: {
        retrieved_at: new Date().toISOString(),
      },
    }));
  }
}

/**
 * Handle 404 Not Found
 */
function handleNotFound(res: ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    ok: false,
    error: {
      code: 'INVALID_INPUT',
      message: 'Not found',
    },
    meta: {
      retrieved_at: new Date().toISOString(),
    },
  }));
}

/**
 * Parse JSON request body from IncomingMessage
 */
function parseRequestBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON in request body'));
      }
    });

    req.on('error', reject);
  });
}
