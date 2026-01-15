import {
  COPYLEFT_LICENSES,
  ATTRIBUTION_REQUIRED_LICENSES,
} from '../config.js';
import {
  type ApiResponse,
  type CheckCompatibilityInput,
  type CheckCompatibilityOutput,
  type Violation,
  CheckCompatibilityInputSchema,
} from '../types.js';

/**
 * Check if a license is a copyleft license
 */
function isCopyleft(licenseId: string): boolean {
  return COPYLEFT_LICENSES.includes(licenseId as (typeof COPYLEFT_LICENSES)[number]);
}

/**
 * Check if a license requires attribution
 */
function requiresAttribution(licenseId: string): boolean {
  return ATTRIBUTION_REQUIRED_LICENSES.includes(
    licenseId as (typeof ATTRIBUTION_REQUIRED_LICENSES)[number]
  );
}

/**
 * Normalize license ID for comparison
 * Handles basic variations like GPL-2.0 vs GPL-2.0-only
 */
function normalizeLicenseForComparison(licenseId: string): string[] {
  const variations: string[] = [licenseId];

  // Handle GPL variations
  if (licenseId.startsWith('GPL-') || licenseId.startsWith('LGPL-') || licenseId.startsWith('AGPL-')) {
    if (licenseId.endsWith('-only')) {
      variations.push(licenseId.replace('-only', ''));
    } else if (licenseId.endsWith('-or-later')) {
      variations.push(licenseId.replace('-or-later', '+'));
    } else if (!licenseId.endsWith('-only') && !licenseId.endsWith('-or-later')) {
      variations.push(`${licenseId}-only`);
    }
  }

  return variations;
}

/**
 * Check if a license matches any in a list (considering variations)
 */
function matchesLicenseList(licenseId: string, list: string[]): boolean {
  const variations = normalizeLicenseForComparison(licenseId);
  return variations.some((v) =>
    list.some((l) => l.toUpperCase() === v.toUpperCase())
  );
}

/**
 * Check if detected licenses are compatible with a target policy
 *
 * @param input - Object containing licenses to check and policy rules
 * @returns API response with compatibility result and any violations
 *
 * POLICY RULES:
 * - allowed: If specified, only these licenses are permitted (whitelist mode)
 * - denied: These licenses are never permitted (blacklist mode)
 * - copyleft_ok: If false, copyleft licenses will generate violations
 * - required_attribution: Informational - lists licenses that need attribution
 *
 * HEURISTICS & LIMITATIONS:
 * - Does NOT perform full license compatibility analysis (e.g., GPL + MIT interaction)
 * - Does NOT check SPDX expression operators (OR, AND, WITH)
 * - Assumes simple license identifiers, not compound expressions
 * - "UNKNOWN" licenses are flagged as violations when using allowed list
 */
export async function checkCompatibility(
  input: unknown
): Promise<ApiResponse<CheckCompatibilityOutput>> {
  const now = new Date().toISOString();

  // Validate input
  const parseResult = CheckCompatibilityInputSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid input for check_compatibility',
        details: parseResult.error.flatten(),
      },
      meta: {
        retrieved_at: now,
      },
    };
  }

  const validInput: CheckCompatibilityInput = parseResult.data;
  const { licenses, policy } = validInput;
  const violations: Violation[] = [];
  const warnings: string[] = [];

  try {
    for (const license of licenses) {
      const licenseId = license.license_id;
      const name = license.name;

      // Check for UNKNOWN licenses
      if (licenseId === 'UNKNOWN') {
        if (policy.allowed && policy.allowed.length > 0) {
          violations.push({
            name,
            license_id: licenseId,
            reason: 'Unknown license cannot be verified against allowed list',
          });
        } else {
          warnings.push(
            `License for ${name ?? 'unnamed package'} is UNKNOWN - manual review recommended`
          );
        }
        continue;
      }

      // Check denied list (blacklist)
      if (policy.denied && matchesLicenseList(licenseId, policy.denied)) {
        violations.push({
          name,
          license_id: licenseId,
          reason: `License "${licenseId}" is in the denied list`,
        });
        continue;
      }

      // Check allowed list (whitelist) - if specified, must be in list
      if (policy.allowed && policy.allowed.length > 0) {
        if (!matchesLicenseList(licenseId, policy.allowed)) {
          violations.push({
            name,
            license_id: licenseId,
            reason: `License "${licenseId}" is not in the allowed list`,
          });
          continue;
        }
      }

      // Check copyleft restriction
      if (policy.copyleft_ok === false && isCopyleft(licenseId)) {
        violations.push({
          name,
          license_id: licenseId,
          reason: `License "${licenseId}" is a copyleft license and copyleft_ok is false`,
        });
        continue;
      }

      // Add attribution warnings
      if (requiresAttribution(licenseId)) {
        warnings.push(
          `License "${licenseId}" for ${name ?? 'unnamed package'} requires attribution`
        );
      }
    }

    const compatible = violations.length === 0;

    return {
      ok: true,
      data: {
        compatible,
        violations,
        warnings,
      },
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
        message: error instanceof Error ? error.message : 'Unknown error during compatibility check',
        details: error instanceof Error ? { stack: error.stack } : {},
      },
      meta: {
        retrieved_at: now,
      },
    };
  }
}
