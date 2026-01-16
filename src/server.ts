import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { toolDefinitions } from './tools/index.js';
import { createHttpTransport } from './transport/index.js';
import type { ServerConfig } from './types.js';

const SERVER_NAME = 'license-check';
const SERVER_VERSION = '1.0.0';

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool listing handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: toolDefinitions.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema),
      })),
    };
  });

  // Register tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = toolDefinitions.find((t) => t.name === name);
    if (!tool) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              error: {
                code: 'INVALID_INPUT',
                message: `Unknown tool: ${name}`,
                details: {
                  available_tools: toolDefinitions.map((t) => t.name),
                },
              },
              meta: {
                retrieved_at: new Date().toISOString(),
              },
            }),
          },
        ],
      };
    }

    try {
      const result = await tool.handler(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
                details: error instanceof Error ? { stack: error.stack } : {},
              },
              meta: {
                retrieved_at: new Date().toISOString(),
              },
            }),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Create a standalone MCP server instance
 * This is useful for HTTP transport where each session needs its own server
 */
export function createStandaloneServer(): Server {
  return createServer();
}

/**
 * Start the MCP server with HTTP transport
 */
export async function startServer(config: ServerConfig): Promise<void> {
  console.error(`[${SERVER_NAME}] Starting server v${SERVER_VERSION}`);
  console.error(`[${SERVER_NAME}] Transport: HTTP`);

  // HTTP transport uses factory function to create server per session
  await createHttpTransport(createStandaloneServer, config);

  console.error(`[${SERVER_NAME}] Server started successfully`);
}
