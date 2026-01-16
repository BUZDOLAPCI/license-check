#!/usr/bin/env node

import { loadConfig } from './config.js';
import { startServer } from './server.js';
import type { TransportType } from './types.js';

/**
 * Parse command line arguments
 */
function parseArgs(): { transport?: TransportType; port?: number; host?: string } {
  const args = process.argv.slice(2);
  const result: { transport?: TransportType; port?: number; host?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--transport' || arg === '-t') {
      if (nextArg === 'stdio' || nextArg === 'http') {
        result.transport = nextArg;
        i++;
      } else {
        console.error(`Invalid transport: ${nextArg}. Must be 'stdio' or 'http'`);
        process.exit(1);
      }
    } else if (arg === '--port' || arg === '-p') {
      const port = parseInt(nextArg ?? '', 10);
      if (isNaN(port)) {
        console.error(`Invalid port: ${nextArg}`);
        process.exit(1);
      }
      result.port = port;
      i++;
    } else if (arg === '--host' || arg === '-h') {
      result.host = nextArg;
      i++;
    } else if (arg === '--stdio') {
      result.transport = 'stdio';
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else if (arg === '--version' || arg === '-v') {
      console.log('license-check v1.0.0');
      process.exit(0);
    }
  }

  return result;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
license-check - MCP server for license detection and compliance checking

Usage:
  license-check [options]

Options:
  -t, --transport <type>  Transport type: http (default) or stdio
  -p, --port <port>       HTTP port (default: 8080, only for http transport)
  -h, --host <host>       HTTP host (default: 127.0.0.1, only for http transport)
  --stdio                 Shortcut for --transport stdio
  --help                  Show this help message
  -v, --version           Show version number

Environment Variables:
  LICENSE_CHECK_TRANSPORT   Transport type (stdio or http)
  LICENSE_CHECK_PORT        HTTP port
  LICENSE_CHECK_HOST        HTTP host
  LICENSE_CHECK_LOG_LEVEL   Log level (debug, info, warn, error)

Examples:
  # Start with HTTP transport (default, for Dedalus deployment)
  license-check

  # Start on a custom port
  license-check --port 3000

  # Start with stdio transport (for MCP client integration)
  license-check --stdio

  # Using environment variables
  LICENSE_CHECK_TRANSPORT=stdio license-check

Tools:
  detect_licenses     Detect licenses from dependency metadata or file contents
  check_compatibility Check if licenses comply with a policy
  generate_notice     Generate a NOTICE file summarizing all licenses
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const cliArgs = parseArgs();
  const config = loadConfig(cliArgs);

  try {
    await startServer(config);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
