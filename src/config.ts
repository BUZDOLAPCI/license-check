import type { ServerConfig } from './types.js';

/**
 * Default server configuration
 */
export const DEFAULT_CONFIG: ServerConfig = {
  port: 8080,
  host: '127.0.0.1',
  logLevel: 'info',
};

/**
 * Load configuration from environment variables
 */
export function loadConfig(overrides?: Partial<ServerConfig>): ServerConfig {
  const port = process.env['LICENSE_CHECK_PORT']
    ? parseInt(process.env['LICENSE_CHECK_PORT'], 10)
    : DEFAULT_CONFIG.port;
  const host = process.env['LICENSE_CHECK_HOST'] || DEFAULT_CONFIG.host;
  const logLevel = (process.env['LICENSE_CHECK_LOG_LEVEL'] as ServerConfig['logLevel']) || DEFAULT_CONFIG.logLevel;

  return {
    port,
    host,
    logLevel,
    ...overrides,
  };
}

/**
 * Known SPDX license identifiers and their common aliases
 */
export const SPDX_LICENSE_IDS = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'ISC',
  'MPL-2.0',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'Unlicense',
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'Artistic-2.0',
  'WTFPL',
  'Zlib',
  'BSL-1.0',
  'EPL-2.0',
  'CDDL-1.0',
  '0BSD',
] as const;

/**
 * License aliases mapping to SPDX identifiers
 */
export const LICENSE_ALIASES: Record<string, string> = {
  'MIT License': 'MIT',
  'The MIT License': 'MIT',
  'Apache License 2.0': 'Apache-2.0',
  'Apache License, Version 2.0': 'Apache-2.0',
  'Apache-2': 'Apache-2.0',
  'Apache 2.0': 'Apache-2.0',
  'BSD-2': 'BSD-2-Clause',
  'BSD 2-Clause': 'BSD-2-Clause',
  'Simplified BSD License': 'BSD-2-Clause',
  'BSD-3': 'BSD-3-Clause',
  'BSD 3-Clause': 'BSD-3-Clause',
  'New BSD License': 'BSD-3-Clause',
  'Modified BSD License': 'BSD-3-Clause',
  'GPL-2.0': 'GPL-2.0-only',
  'GPLv2': 'GPL-2.0-only',
  'GNU GPL v2': 'GPL-2.0-only',
  'GPL-3.0': 'GPL-3.0-only',
  'GPLv3': 'GPL-3.0-only',
  'GNU GPL v3': 'GPL-3.0-only',
  'LGPL-2.1': 'LGPL-2.1-only',
  'LGPLv2.1': 'LGPL-2.1-only',
  'LGPL-3.0': 'LGPL-3.0-only',
  'LGPLv3': 'LGPL-3.0-only',
  'MPL 2.0': 'MPL-2.0',
  'Mozilla Public License 2.0': 'MPL-2.0',
  'AGPL-3.0': 'AGPL-3.0-only',
  'AGPLv3': 'AGPL-3.0-only',
  'Public Domain': 'Unlicense',
  'CC0': 'CC0-1.0',
  'Creative Commons Zero': 'CC0-1.0',
};

/**
 * Copyleft licenses that require derivative works to use the same license
 */
export const COPYLEFT_LICENSES = [
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'MPL-2.0',
  'EPL-2.0',
  'CDDL-1.0',
  'CC-BY-SA-4.0',
] as const;

/**
 * Licenses that require attribution in derived works
 */
export const ATTRIBUTION_REQUIRED_LICENSES = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'BSL-1.0',
  'Artistic-2.0',
  'Zlib',
] as const;

/**
 * License patterns for text-based detection
 */
export const LICENSE_PATTERNS: Array<{ pattern: RegExp; license: string; confidence: 'high' | 'medium' }> = [
  // MIT
  {
    pattern: /Permission is hereby granted,?\s+free of charge/i,
    license: 'MIT',
    confidence: 'high',
  },
  {
    pattern: /MIT License/i,
    license: 'MIT',
    confidence: 'high',
  },
  // Apache-2.0
  {
    pattern: /Apache License[,\s]+Version 2\.0/i,
    license: 'Apache-2.0',
    confidence: 'high',
  },
  {
    pattern: /Licensed under the Apache License/i,
    license: 'Apache-2.0',
    confidence: 'medium',
  },
  // BSD-3-Clause (header match - must come before BSD-2-Clause content match)
  {
    pattern: /BSD 3-Clause License/i,
    license: 'BSD-3-Clause',
    confidence: 'high',
  },
  // BSD-2-Clause
  {
    pattern: /Redistribution and use in source and binary forms[\s\S]*?2\.\s*Redistributions in binary form/i,
    license: 'BSD-2-Clause',
    confidence: 'high',
  },
  // BSD-3-Clause (content match)
  {
    pattern: /Redistribution and use in source and binary forms[\s\S]*?3\.\s*(Neither the name|The name)/i,
    license: 'BSD-3-Clause',
    confidence: 'high',
  },
  // ISC
  {
    pattern: /ISC License/i,
    license: 'ISC',
    confidence: 'high',
  },
  {
    pattern: /Permission to use, copy, modify, and\/or distribute this software/i,
    license: 'ISC',
    confidence: 'medium',
  },
  // GPL-2.0
  {
    pattern: /GNU GENERAL PUBLIC LICENSE[\s\S]*?Version 2,?\s/i,
    license: 'GPL-2.0-only',
    confidence: 'high',
  },
  // GPL-3.0
  {
    pattern: /GNU GENERAL PUBLIC LICENSE[\s\S]*?Version 3,?\s/i,
    license: 'GPL-3.0-only',
    confidence: 'high',
  },
  // LGPL-2.1
  {
    pattern: /GNU LESSER GENERAL PUBLIC LICENSE[\s\S]*?Version 2\.1/i,
    license: 'LGPL-2.1-only',
    confidence: 'high',
  },
  // LGPL-3.0
  {
    pattern: /GNU LESSER GENERAL PUBLIC LICENSE[\s\S]*?Version 3/i,
    license: 'LGPL-3.0-only',
    confidence: 'high',
  },
  // AGPL-3.0
  {
    pattern: /GNU AFFERO GENERAL PUBLIC LICENSE[\s\S]*?Version 3/i,
    license: 'AGPL-3.0-only',
    confidence: 'high',
  },
  // MPL-2.0
  {
    pattern: /Mozilla Public License[,\s]+Version 2\.0/i,
    license: 'MPL-2.0',
    confidence: 'high',
  },
  // Unlicense
  {
    pattern: /This is free and unencumbered software released into the public domain/i,
    license: 'Unlicense',
    confidence: 'high',
  },
  // CC0-1.0
  {
    pattern: /CC0 1\.0 Universal/i,
    license: 'CC0-1.0',
    confidence: 'high',
  },
  // WTFPL
  {
    pattern: /DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE/i,
    license: 'WTFPL',
    confidence: 'high',
  },
  // Zlib
  {
    pattern: /zlib License/i,
    license: 'Zlib',
    confidence: 'high',
  },
  // BSL-1.0
  {
    pattern: /Boost Software License[,\s-]+Version 1\.0/i,
    license: 'BSL-1.0',
    confidence: 'high',
  },
  // EPL-2.0
  {
    pattern: /Eclipse Public License[,\s-]+v(ersion)?\s*2\.0/i,
    license: 'EPL-2.0',
    confidence: 'high',
  },
];
