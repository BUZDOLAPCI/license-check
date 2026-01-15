# @dedalus/license-check

MCP server for detecting software licenses and checking compatibility against organizational policies. Produces NOTICE file summaries for compliance documentation.

## Features

- **License Detection**: Identify licenses from dependency metadata or LICENSE file contents
- **Compatibility Checking**: Validate licenses against configurable policies (allowed/denied lists, copyleft restrictions)
- **NOTICE Generation**: Generate standardized NOTICE files for compliance documentation
- **SPDX Compliance**: Uses SPDX license identifiers throughout
- **Dual Transport**: Supports both stdio (MCP protocol) and HTTP (REST API) transports

## Installation

```bash
npm install @dedalus/license-check
```

## Quick Start

### As MCP Server (stdio)

```bash
# Start with default stdio transport
npx license-check

# Or explicitly
npx license-check --transport stdio
```

### As HTTP Server

```bash
# Start HTTP server on port 3000
npx license-check --transport http

# Custom port
npx license-check --transport http --port 8080
```

## Tools

### detect_licenses

Detect licenses from dependencies list or file contents.

**Input Options:**

```json
{
  "dependencies": [
    { "name": "lodash", "version": "4.17.21", "license_id": "MIT" },
    { "name": "custom-pkg", "license_text": "MIT License\n\nPermission is hereby granted..." }
  ]
}
```

Or from files:

```json
{
  "files": [
    { "filename": "LICENSE", "content": "Apache License, Version 2.0..." }
  ]
}
```

**Output:**

```json
{
  "ok": true,
  "data": {
    "detected": [
      {
        "name": "lodash",
        "version": "4.17.21",
        "license_id": "MIT",
        "confidence": "high",
        "source": "dependency_metadata"
      }
    ]
  },
  "meta": {
    "source": "license-check",
    "retrieved_at": "2024-01-15T10:30:00.000Z",
    "pagination": { "next_cursor": null }
  }
}
```

### check_compatibility

Check if detected licenses are compatible with a target policy.

**Input:**

```json
{
  "licenses": [
    { "name": "lodash", "license_id": "MIT" },
    { "name": "gpl-lib", "license_id": "GPL-3.0-only" }
  ],
  "policy": {
    "allowed": ["MIT", "Apache-2.0", "ISC", "BSD-3-Clause"],
    "denied": ["AGPL-3.0-only"],
    "copyleft_ok": false
  }
}
```

**Output:**

```json
{
  "ok": true,
  "data": {
    "compatible": false,
    "violations": [
      {
        "name": "gpl-lib",
        "license_id": "GPL-3.0-only",
        "reason": "License \"GPL-3.0-only\" is a copyleft license and copyleft_ok is false"
      }
    ],
    "warnings": []
  },
  "meta": {
    "source": "license-check",
    "retrieved_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### generate_notice

Generate a NOTICE file content summarizing all licenses and attributions.

**Input:**

```json
{
  "licenses": [
    {
      "name": "lodash",
      "version": "4.17.21",
      "license_id": "MIT",
      "copyright": "Copyright JS Foundation",
      "url": "https://github.com/lodash/lodash"
    }
  ],
  "project_name": "MyProject"
}
```

**Output:**

```json
{
  "ok": true,
  "data": {
    "notice_text": "==============================================================================\nNOTICE file for MyProject\n..."
  },
  "meta": {
    "source": "license-check",
    "retrieved_at": "2024-01-15T10:30:00.000Z"
  }
}
```

## HTTP API Endpoints

When running with HTTP transport:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/tools` | GET | List available tools |
| `/tools/:toolName` | POST | Execute a tool |

**Example:**

```bash
# List tools
curl http://localhost:3000/tools

# Detect licenses
curl -X POST http://localhost:3000/tools/detect_licenses \
  -H "Content-Type: application/json" \
  -d '{"dependencies": [{"name": "lodash", "license_id": "MIT"}]}'
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LICENSE_CHECK_TRANSPORT` | `stdio` | Transport type: `stdio` or `http` |
| `LICENSE_CHECK_PORT` | `3000` | HTTP server port |
| `LICENSE_CHECK_HOST` | `127.0.0.1` | HTTP server host |
| `LICENSE_CHECK_LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |

### CLI Options

```
-t, --transport <type>  Transport type: stdio (default) or http
-p, --port <port>       HTTP port (default: 3000)
-h, --host <host>       HTTP host (default: 127.0.0.1)
--help                  Show help message
-v, --version           Show version number
```

## Supported Licenses

The server recognizes the following SPDX license identifiers:

- **Permissive**: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, Unlicense, CC0-1.0, Zlib, BSL-1.0
- **Copyleft**: GPL-2.0-only, GPL-3.0-only, LGPL-2.1-only, LGPL-3.0-only, AGPL-3.0-only, MPL-2.0, EPL-2.0
- **Creative Commons**: CC-BY-4.0, CC-BY-SA-4.0
- **Others**: Artistic-2.0, WTFPL, CDDL-1.0

## Heuristics and Limitations

### License Detection

- Uses regex pattern matching for license text analysis
- May not detect non-standard or heavily modified license text
- Confidence levels indicate detection reliability:
  - `high`: Full license header/text matched
  - `medium`: Partial match or common phrases detected
  - `low`: Only license name keyword found or unknown license
- Does NOT validate license text completeness
- SPDX compound expressions (e.g., "MIT OR Apache-2.0") are not fully parsed

### Compatibility Checking

- Does NOT perform full license compatibility analysis between licenses
- Does NOT parse SPDX expression operators (OR, AND, WITH)
- Assumes simple license identifiers, not compound expressions
- "UNKNOWN" licenses are flagged as violations when using allowed list

## Response Envelope

All tools return responses in the standard Dedalus envelope format:

**Success:**
```json
{
  "ok": true,
  "data": {},
  "meta": {
    "source": "license-check",
    "retrieved_at": "ISO-8601 timestamp",
    "pagination": { "next_cursor": null },
    "warnings": []
  }
}
```

**Error:**
```json
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT | INTERNAL_ERROR | ...",
    "message": "human readable message",
    "details": {}
  },
  "meta": {
    "retrieved_at": "ISO-8601 timestamp"
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Development mode (watch)
npm run dev
```

## License

MIT
