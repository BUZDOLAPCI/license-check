export { detectLicenses } from './detect.js';
export { checkCompatibility } from './compat.js';
export { generateNotice } from './notice.js';

import { detectLicenses } from './detect.js';
import { checkCompatibility } from './compat.js';
import { generateNotice } from './notice.js';
import {
  DetectLicensesInputSchema,
  CheckCompatibilityInputSchema,
  GenerateNoticeInputSchema,
  type ToolDefinition,
} from '../types.js';

/**
 * Tool definitions for MCP server registration
 */
export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'detect_licenses',
    description: `Detect licenses from dependencies list or file contents.

INPUT OPTIONS:
- dependencies: Array of { name, version?, license_text?, license_id? }
  - If license_id is provided, it will be normalized to SPDX format
  - If license_text is provided, pattern matching will detect the license
- files: Array of { filename, content } to analyze LICENSE/COPYING files

OUTPUT:
- detected: Array of { name?, version?, license_id, confidence, source }
  - confidence: "high" | "medium" | "low"
  - source: "dependency_metadata" | "license_text_analysis" | "file:{filename}"

LIMITATIONS:
- Uses heuristic pattern matching, not authoritative license verification
- May not detect modified or non-standard license text
- SPDX compound expressions (e.g., "MIT OR Apache-2.0") are not parsed`,
    inputSchema: DetectLicensesInputSchema,
    handler: detectLicenses,
  },
  {
    name: 'check_compatibility',
    description: `Check if detected licenses are compatible with a target policy.

INPUT:
- licenses: Array of { name?, license_id } to check
- policy: {
    allowed?: string[]     - Whitelist of permitted licenses (if set, only these are allowed)
    denied?: string[]      - Blacklist of forbidden licenses
    copyleft_ok?: boolean  - If false, copyleft licenses (GPL, LGPL, AGPL, etc.) violate policy
  }

OUTPUT:
- compatible: boolean - true if no violations found
- violations: Array of { name?, license_id, reason } describing policy breaches
- warnings: Array of strings with non-blocking notices

LIMITATIONS:
- Does NOT perform full license compatibility analysis between licenses
- Does NOT parse SPDX expression operators (OR, AND, WITH)
- UNKNOWN licenses are violations when using allowed list`,
    inputSchema: CheckCompatibilityInputSchema,
    handler: checkCompatibility,
  },
  {
    name: 'generate_notice',
    description: `Generate a NOTICE file content summarizing all licenses and attributions.

INPUT:
- licenses: Array of { name, version?, license_id, copyright?, url? }
- project_name?: string - Name to include in header

OUTPUT:
- notice_text: Formatted NOTICE file content

The output groups packages by license type and includes:
- Header with project name and generation date
- Each license section with full name and SPDX identifier
- Package listings with copyright and URL if provided
- Footer with end marker`,
    inputSchema: GenerateNoticeInputSchema,
    handler: generateNotice,
  },
];
