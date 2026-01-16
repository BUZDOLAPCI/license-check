#!/usr/bin/env node

import { startServer } from './server.js';
import type { ServerConfig } from './types.js';

/**
 * Parse command line arguments
 */
function parseArgs(): { port?: number; host?: string } {
  const args = process.argv.slice(2);
  const result: { port?: number; host?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--port' || arg === '-p') {
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
  -p, --port <port>       HTTP port (default: 8080)
  -h, --host <host>       HTTP host (default: 127.0.0.1)
  --help                  Show this help message
  -v, --version           Show version number

Environment Variables:
  LICENSE_CHECK_PORT        HTTP port
  LICENSE_CHECK_HOST        HTTP host
  LICENSE_CHECK_LOG_LEVEL   Log level (debug, info, warn, error)

Examples:
  # Start HTTP server on default port 8080
  license-check

  # Start on a custom port
  license-check --port 3000

Tools:
  detect_licenses     Detect licenses from dependency metadata or file contents
  check_compatibility Check if licenses comply with a policy
  generate_notice     Generate a NOTICE file summarizing all licenses
`);
}

/**
 * Load configuration from environment variables and CLI args
 */
function loadConfig(overrides?: { port?: number; host?: string }): ServerConfig {
  const port = overrides?.port ??
    (process.env['LICENSE_CHECK_PORT'] ? parseInt(process.env['LICENSE_CHECK_PORT'], 10) : 8080);
  const host = overrides?.host ?? process.env['LICENSE_CHECK_HOST'] ?? '127.0.0.1';
  const logLevel = (process.env['LICENSE_CHECK_LOG_LEVEL'] as ServerConfig['logLevel']) ?? 'info';

  return {
    port,
    host,
    logLevel,
  };
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
