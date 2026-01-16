import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer as createHttpServer, type Server as HttpServer } from 'http';
import { createStandaloneServer } from '../../src/server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { IncomingMessage, ServerResponse } from 'http';

describe('HTTP Transport /mcp endpoint', () => {
  let httpServer: HttpServer;
  let port: number;
  const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: Server }>();

  beforeAll(async () => {
    // Create HTTP server with MCP endpoint
    httpServer = createHttpServer();

    httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);

      if (url.pathname === '/mcp') {
        // Get or create session
        const sessionId = (req.headers['mcp-session-id'] as string) || randomUUID();

        let session = sessions.get(sessionId);

        if (!session) {
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => sessionId,
          });

          const server = createStandaloneServer();
          await server.connect(transport);

          session = { transport, server };
          sessions.set(sessionId, session);
        }

        await session.transport.handleRequest(req, res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    // Start on random available port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Clean up sessions
    for (const [, session] of sessions) {
      await session.server.close();
      await session.transport.close();
    }
    sessions.clear();

    // Close HTTP server
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it('should respond to tools/list JSON-RPC request on /mcp endpoint', async () => {
    // First, we need to send an initialize request to establish the session
    const initializeRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    };

    const initResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify(initializeRequest),
    });

    expect(initResponse.ok).toBe(true);

    // Get session ID from response header
    const sessionId = initResponse.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();

    // Parse initialize response
    const initText = await initResponse.text();
    expect(initText).toBeTruthy();

    // Now send tools/list request using the session
    const toolsListRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    };

    const toolsResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId!,
      },
      body: JSON.stringify(toolsListRequest),
    });

    expect(toolsResponse.ok).toBe(true);

    const toolsText = await toolsResponse.text();
    expect(toolsText).toBeTruthy();

    // The response should contain tools
    // Parse the response - it may be JSON or SSE format
    let tools: Array<{ name: string }> = [];

    if (toolsText.startsWith('{')) {
      // Direct JSON response
      const jsonResponse = JSON.parse(toolsText);
      if (jsonResponse.result && jsonResponse.result.tools) {
        tools = jsonResponse.result.tools;
      }
    } else if (toolsText.includes('data:')) {
      // SSE format - parse the data lines
      const lines = toolsText.split('\n');
      for (const line of lines) {
        if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.slice(5).trim());
            if (data.result && data.result.tools) {
              tools = data.result.tools;
              break;
            }
          } catch {
            // Continue to next line
          }
        }
      }
    }

    // Verify we got the expected tools
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('detect_licenses');
    expect(toolNames).toContain('check_compatibility');
    expect(toolNames).toContain('generate_notice');
  });

  it('should return 404 for non-existent endpoints', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/nonexistent`, {
      method: 'GET',
    });

    expect(response.status).toBe(404);
  });
});
