import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import type { ServerConfig } from '../types.js';
import { toolDefinitions, detectLicenses, checkCompatibility, generateNotice } from '../tools/index.js';

const SERVER_VERSION = '1.0.0';

/**
 * JSON-RPC request structure
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC response structure
 */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP-compatible tool definitions with JSON Schema format
 * These are used for tools/list responses
 */
const mcpToolDefinitions = [
  {
    name: 'detect_licenses',
    description: toolDefinitions[0]?.description ?? '',
    inputSchema: {
      type: 'object' as const,
      properties: {
        dependencies: {
          type: 'array',
          description: 'Array of dependency objects to analyze',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Package name' },
              version: { type: 'string', description: 'Package version' },
              license_text: { type: 'string', description: 'License text to analyze' },
              license_id: { type: 'string', description: 'Known SPDX license identifier' },
            },
            required: ['name'],
          },
        },
        files: {
          type: 'array',
          description: 'Array of file objects to analyze',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string', description: 'Name of the file' },
              content: { type: 'string', description: 'File content to analyze' },
            },
            required: ['filename', 'content'],
          },
        },
      },
    },
  },
  {
    name: 'check_compatibility',
    description: toolDefinitions[1]?.description ?? '',
    inputSchema: {
      type: 'object' as const,
      properties: {
        licenses: {
          type: 'array',
          description: 'Array of license objects to check',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Optional package name' },
              license_id: { type: 'string', description: 'SPDX license identifier' },
            },
            required: ['license_id'],
          },
        },
        policy: {
          type: 'object',
          description: 'Compatibility policy to check against',
          properties: {
            allowed: {
              type: 'array',
              items: { type: 'string' },
              description: 'Whitelist of permitted licenses',
            },
            denied: {
              type: 'array',
              items: { type: 'string' },
              description: 'Blacklist of forbidden licenses',
            },
            copyleft_ok: {
              type: 'boolean',
              description: 'If false, copyleft licenses violate policy',
            },
          },
        },
      },
      required: ['licenses', 'policy'],
    },
  },
  {
    name: 'generate_notice',
    description: toolDefinitions[2]?.description ?? '',
    inputSchema: {
      type: 'object' as const,
      properties: {
        licenses: {
          type: 'array',
          description: 'Array of package license objects',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Package name' },
              version: { type: 'string', description: 'Package version' },
              license_id: { type: 'string', description: 'SPDX license identifier' },
              copyright: { type: 'string', description: 'Copyright notice' },
              url: { type: 'string', description: 'Package URL' },
            },
            required: ['name', 'license_id'],
          },
        },
        project_name: {
          type: 'string',
          description: 'Name to include in NOTICE header',
        },
      },
      required: ['licenses'],
    },
  },
];

/**
 * Handle a single JSON-RPC request
 */
async function handleJsonRpcRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'license-check',
              version: SERVER_VERSION,
            },
          },
        };
      }

      case 'tools/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: mcpToolDefinitions,
          },
        };
      }

      case 'tools/call': {
        const toolName = params?.['name'] as string;
        const args = params?.['arguments'] as Record<string, unknown>;

        let result: unknown;

        switch (toolName) {
          case 'detect_licenses': {
            result = await detectLicenses(args);
            break;
          }

          case 'check_compatibility': {
            result = await checkCompatibility(args);
            break;
          }

          case 'generate_notice': {
            result = await generateNotice(args);
            break;
          }

          default:
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Unknown tool: ${toolName}`,
              },
            };
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: `Internal error: ${message}`,
      },
    };
  }
}

/**
 * Read the request body as a string
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/**
 * Send a JSON response
 */
function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Handle health check endpoint
 */
function handleHealthCheck(res: ServerResponse): void {
  sendJson(res, 200, { status: 'ok', service: 'license-check' });
}

/**
 * Handle not found
 */
function handleNotFound(res: ServerResponse): void {
  sendJson(res, 404, { error: 'Not found' });
}

/**
 * Handle method not allowed
 */
function handleMethodNotAllowed(res: ServerResponse): void {
  sendJson(res, 405, { error: 'Method not allowed' });
}

/**
 * Handle MCP JSON-RPC endpoint
 */
async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await readBody(req);
    const request: JsonRpcRequest = JSON.parse(body);

    if (!request.jsonrpc || request.jsonrpc !== '2.0') {
      sendJson(res, 400, {
        jsonrpc: '2.0',
        id: request.id || 0,
        error: {
          code: -32600,
          message: 'Invalid Request: missing or invalid jsonrpc version',
        },
      });
      return;
    }

    const response = await handleJsonRpcRequest(request);
    sendJson(res, 200, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJson(res, 500, {
      jsonrpc: '2.0',
      id: 0,
      error: {
        code: -32700,
        message: `Parse error: ${message}`,
      },
    });
  }
}

/**
 * Handle REST API detect endpoint
 */
async function handleDetectApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await readBody(req);
    const args = body ? JSON.parse(body) : {};
    const result = await detectLicenses(args);
    sendJson(res, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJson(res, 500, { ok: false, error: message });
  }
}

/**
 * Handle REST API compatibility endpoint
 */
async function handleCompatibilityApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await readBody(req);
    const args = body ? JSON.parse(body) : {};
    const result = await checkCompatibility(args);
    sendJson(res, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJson(res, 500, { ok: false, error: message });
  }
}

/**
 * Handle REST API notice endpoint
 */
async function handleNoticeApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await readBody(req);
    const args = body ? JSON.parse(body) : {};
    const result = await generateNotice(args);
    sendJson(res, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJson(res, 500, { ok: false, error: message });
  }
}

/**
 * Create and configure the HTTP server
 */
export function createHttpServer(): Server {
  const httpServer = createServer();

  httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url!, `http://${req.headers.host || 'localhost'}`);
    const method = req.method?.toUpperCase();

    try {
      switch (url.pathname) {
        case '/mcp':
          if (method === 'POST') {
            await handleMcpRequest(req, res);
          } else {
            handleMethodNotAllowed(res);
          }
          break;

        case '/health':
          if (method === 'GET') {
            handleHealthCheck(res);
          } else {
            handleMethodNotAllowed(res);
          }
          break;

        case '/api/detect':
          if (method === 'POST') {
            await handleDetectApi(req, res);
          } else {
            handleMethodNotAllowed(res);
          }
          break;

        case '/api/compatibility':
          if (method === 'POST') {
            await handleCompatibilityApi(req, res);
          } else {
            handleMethodNotAllowed(res);
          }
          break;

        case '/api/notice':
          if (method === 'POST') {
            await handleNoticeApi(req, res);
          } else {
            handleMethodNotAllowed(res);
          }
          break;

        default:
          handleNotFound(res);
      }
    } catch (error) {
      console.error('Server error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      sendJson(res, 500, { ok: false, error: message });
    }
  });

  return httpServer;
}

/**
 * Start the HTTP transport
 */
export function startHttpTransport(config: Partial<ServerConfig> = {}): Server {
  const port = config.port ?? 8080;
  const host = config.host ?? '127.0.0.1';
  const httpServer = createHttpServer();

  httpServer.listen(port, host, () => {
    console.log(`license-check HTTP server listening on http://${host}:${port}`);
    console.log(`MCP endpoint: http://${host}:${port}/mcp`);
    console.log(`Health check: http://${host}:${port}/health`);
  });

  return httpServer;
}

/**
 * Create and start an HTTP transport for the MCP server
 *
 * This provides MCP protocol support via direct JSON-RPC handling
 * using raw Node.js HTTP for compatibility with stateless Dedalus platform requests.
 *
 * @param _createServerFn - Unused, kept for API compatibility
 * @param config - Server configuration
 * @returns Promise that resolves when the HTTP server is listening
 */
export async function createHttpTransport(
  _createServerFn: () => unknown,
  config: ServerConfig
): Promise<void> {
  const port = config.port ?? 8080;
  const host = config.host ?? '127.0.0.1';

  const httpServer = createHttpServer();

  return new Promise((resolve) => {
    httpServer.listen(port, host, () => {
      console.error(`[license-check] HTTP server listening on http://${host}:${port}`);
      console.error(`[license-check] Available endpoints:`);
      console.error(`  POST /mcp - MCP protocol endpoint (stateless JSON-RPC)`);
      console.error(`  GET  /health - Health check`);
      console.error(`  POST /api/detect - Detect licenses`);
      console.error(`  POST /api/compatibility - Check compatibility`);
      console.error(`  POST /api/notice - Generate notice`);
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
