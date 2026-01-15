import {
  type ApiResponse,
  type GenerateNoticeInput,
  type GenerateNoticeOutput,
  GenerateNoticeInputSchema,
} from '../types.js';

/**
 * License full name mapping for NOTICE file readability
 */
const LICENSE_FULL_NAMES: Record<string, string> = {
  'MIT': 'MIT License',
  'Apache-2.0': 'Apache License 2.0',
  'BSD-2-Clause': 'BSD 2-Clause "Simplified" License',
  'BSD-3-Clause': 'BSD 3-Clause "New" or "Revised" License',
  'ISC': 'ISC License',
  'GPL-2.0-only': 'GNU General Public License v2.0 only',
  'GPL-2.0-or-later': 'GNU General Public License v2.0 or later',
  'GPL-3.0-only': 'GNU General Public License v3.0 only',
  'GPL-3.0-or-later': 'GNU General Public License v3.0 or later',
  'LGPL-2.1-only': 'GNU Lesser General Public License v2.1 only',
  'LGPL-2.1-or-later': 'GNU Lesser General Public License v2.1 or later',
  'LGPL-3.0-only': 'GNU Lesser General Public License v3.0 only',
  'LGPL-3.0-or-later': 'GNU Lesser General Public License v3.0 or later',
  'AGPL-3.0-only': 'GNU Affero General Public License v3.0 only',
  'AGPL-3.0-or-later': 'GNU Affero General Public License v3.0 or later',
  'MPL-2.0': 'Mozilla Public License 2.0',
  'Unlicense': 'The Unlicense',
  'CC0-1.0': 'Creative Commons Zero v1.0 Universal',
  'CC-BY-4.0': 'Creative Commons Attribution 4.0 International',
  'CC-BY-SA-4.0': 'Creative Commons Attribution-ShareAlike 4.0 International',
  'BSL-1.0': 'Boost Software License 1.0',
  'EPL-2.0': 'Eclipse Public License 2.0',
  'Artistic-2.0': 'Artistic License 2.0',
  'WTFPL': 'Do What The F*ck You Want To Public License',
  'Zlib': 'zlib License',
  '0BSD': 'BSD Zero Clause License',
};

/**
 * Get full license name from SPDX identifier
 */
function getLicenseFullName(licenseId: string): string {
  return LICENSE_FULL_NAMES[licenseId] ?? licenseId;
}

/**
 * Group licenses by their SPDX identifier
 */
function groupByLicense(
  licenses: GenerateNoticeInput['licenses']
): Map<string, GenerateNoticeInput['licenses']> {
  const groups = new Map<string, GenerateNoticeInput['licenses']>();

  for (const license of licenses) {
    const existing = groups.get(license.license_id);
    if (existing) {
      existing.push(license);
    } else {
      groups.set(license.license_id, [license]);
    }
  }

  return groups;
}

/**
 * Generate a NOTICE file content summarizing all licenses and attributions
 *
 * @param input - Object containing licenses and optional project name
 * @returns API response with formatted NOTICE text
 *
 * OUTPUT FORMAT:
 * - Header with project name and generation timestamp
 * - Grouped by license type for readability
 * - Lists each package with version and copyright (if available)
 * - Includes both SPDX identifier and full license name
 */
export async function generateNotice(
  input: unknown
): Promise<ApiResponse<GenerateNoticeOutput>> {
  const now = new Date().toISOString();

  // Validate input
  const parseResult = GenerateNoticeInputSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid input for generate_notice',
        details: parseResult.error.flatten(),
      },
      meta: {
        retrieved_at: now,
      },
    };
  }

  const validInput: GenerateNoticeInput = parseResult.data;
  const { licenses, project_name } = validInput;
  const warnings: string[] = [];

  try {
    const lines: string[] = [];
    const dateStr = new Date().toISOString().split('T')[0];

    // Header
    lines.push('=' .repeat(78));
    if (project_name) {
      lines.push(`NOTICE file for ${project_name}`);
    } else {
      lines.push('NOTICE file');
    }
    lines.push(`Generated on: ${dateStr}`);
    lines.push('='.repeat(78));
    lines.push('');
    lines.push(
      'This project includes software developed by third parties. ' +
      'The following is a list of all third-party components and their licenses.'
    );
    lines.push('');

    // Group by license
    const grouped = groupByLicense(licenses);

    // Sort license groups for consistent output
    const sortedLicenses = Array.from(grouped.keys()).sort();

    for (const licenseId of sortedLicenses) {
      const packages = grouped.get(licenseId);
      if (!packages) continue;

      lines.push('-'.repeat(78));
      lines.push(`License: ${getLicenseFullName(licenseId)} (${licenseId})`);
      lines.push('-'.repeat(78));
      lines.push('');
      lines.push('The following components are licensed under this license:');
      lines.push('');

      // Sort packages by name
      const sortedPackages = [...packages].sort((a, b) => a.name.localeCompare(b.name));

      for (const pkg of sortedPackages) {
        const versionStr = pkg.version ? `@${pkg.version}` : '';
        lines.push(`  * ${pkg.name}${versionStr}`);

        if (pkg.copyright) {
          lines.push(`    Copyright: ${pkg.copyright}`);
        }

        if (pkg.url) {
          lines.push(`    URL: ${pkg.url}`);
        }

        // Check for UNKNOWN licenses
        if (licenseId === 'UNKNOWN') {
          warnings.push(`Package "${pkg.name}" has unknown license - manual review required`);
        }
      }

      lines.push('');
    }

    // Footer
    lines.push('='.repeat(78));
    lines.push('END OF NOTICE FILE');
    lines.push('='.repeat(78));

    const notice_text = lines.join('\n');

    return {
      ok: true,
      data: { notice_text },
      meta: {
        source: 'license-check',
        retrieved_at: now,
        pagination: { next_cursor: null },
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error during NOTICE generation',
        details: error instanceof Error ? { stack: error.stack } : {},
      },
      meta: {
        retrieved_at: now,
      },
    };
  }
}
