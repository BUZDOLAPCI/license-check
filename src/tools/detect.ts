import {
  LICENSE_ALIASES,
  LICENSE_PATTERNS,
  SPDX_LICENSE_IDS,
} from '../config.js';
import {
  type ApiResponse,
  type ConfidenceLevel,
  type DetectedLicense,
  type DetectLicensesInput,
  type DetectLicensesOutput,
  DetectLicensesInputSchema,
} from '../types.js';

/**
 * Normalize a license identifier to its SPDX form
 */
function normalizeLicenseId(licenseId: string): string {
  const trimmed = licenseId.trim();

  // Check if it's a known alias
  if (trimmed in LICENSE_ALIASES) {
    return LICENSE_ALIASES[trimmed] as string;
  }

  // Check case-insensitive match against known SPDX IDs
  const upperTrimmed = trimmed.toUpperCase();
  for (const spdxId of SPDX_LICENSE_IDS) {
    if (spdxId.toUpperCase() === upperTrimmed) {
      return spdxId;
    }
  }

  // Return as-is if not found
  return trimmed;
}

/**
 * Detect license from text content using pattern matching
 *
 * HEURISTICS & LIMITATIONS:
 * - Uses regex patterns to match common license text signatures
 * - May not detect non-standard or modified licenses
 * - Confidence levels indicate detection reliability:
 *   - high: Full license header/text matched
 *   - medium: Partial match or common phrases detected
 *   - low: Only license name keyword found
 * - Does NOT validate license text completeness
 * - Does NOT detect compound/dual licenses from text (e.g., "MIT OR Apache-2.0")
 */
function detectFromText(text: string): { license_id: string; confidence: ConfidenceLevel } | null {
  // First, try pattern matching for high/medium confidence
  for (const { pattern, license, confidence } of LICENSE_PATTERNS) {
    if (pattern.test(text)) {
      return { license_id: license, confidence };
    }
  }

  // Fallback: look for SPDX identifier mentions (low confidence)
  for (const spdxId of SPDX_LICENSE_IDS) {
    const regex = new RegExp(`\\b${spdxId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      return { license_id: spdxId, confidence: 'low' };
    }
  }

  // Check for aliases mentioned in text
  for (const [alias, spdxId] of Object.entries(LICENSE_ALIASES)) {
    const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      return { license_id: spdxId, confidence: 'low' };
    }
  }

  return null;
}

/**
 * Detect licenses from dependencies list or file contents
 *
 * @param input - Object containing either dependencies or files to analyze
 * @returns API response with detected licenses
 *
 * HEURISTICS & LIMITATIONS:
 * - For dependencies with license_id: Normalizes to SPDX identifier, high confidence
 * - For dependencies with license_text: Uses pattern matching, variable confidence
 * - For files: Uses pattern matching on content, variable confidence
 * - SPDX expression parsing (e.g., "MIT OR Apache-2.0") treats compound expressions as-is
 * - Unknown licenses are returned with their original identifier and low confidence
 */
export async function detectLicenses(
  input: unknown
): Promise<ApiResponse<DetectLicensesOutput>> {
  const now = new Date().toISOString();

  // Validate input
  const parseResult = DetectLicensesInputSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid input for detect_licenses',
        details: parseResult.error.flatten(),
      },
      meta: {
        retrieved_at: now,
      },
    };
  }

  const validInput: DetectLicensesInput = parseResult.data;
  const detected: DetectedLicense[] = [];
  const warnings: string[] = [];

  try {
    // Process dependencies
    if (validInput.dependencies) {
      for (const dep of validInput.dependencies) {
        // If license_id is provided, normalize it
        if (dep.license_id) {
          const normalizedId = normalizeLicenseId(dep.license_id);
          const isKnown = SPDX_LICENSE_IDS.includes(normalizedId as (typeof SPDX_LICENSE_IDS)[number]);

          detected.push({
            name: dep.name,
            version: dep.version,
            license_id: normalizedId,
            confidence: isKnown ? 'high' : 'medium',
            source: 'dependency_metadata',
          });
        }
        // If license_text is provided, try to detect from text
        else if (dep.license_text) {
          const detection = detectFromText(dep.license_text);
          if (detection) {
            detected.push({
              name: dep.name,
              version: dep.version,
              license_id: detection.license_id,
              confidence: detection.confidence,
              source: 'license_text_analysis',
            });
          } else {
            warnings.push(
              `Could not detect license for ${dep.name}${dep.version ? `@${dep.version}` : ''} from provided text`
            );
            detected.push({
              name: dep.name,
              version: dep.version,
              license_id: 'UNKNOWN',
              confidence: 'low',
              source: 'license_text_analysis',
            });
          }
        }
        // No license info provided
        else {
          warnings.push(
            `No license information provided for ${dep.name}${dep.version ? `@${dep.version}` : ''}`
          );
          detected.push({
            name: dep.name,
            version: dep.version,
            license_id: 'UNKNOWN',
            confidence: 'low',
            source: 'no_data',
          });
        }
      }
    }

    // Process files
    if (validInput.files) {
      for (const file of validInput.files) {
        const detection = detectFromText(file.content);
        if (detection) {
          detected.push({
            name: file.filename,
            license_id: detection.license_id,
            confidence: detection.confidence,
            source: `file:${file.filename}`,
          });
        } else {
          warnings.push(`Could not detect license from file: ${file.filename}`);
          detected.push({
            name: file.filename,
            license_id: 'UNKNOWN',
            confidence: 'low',
            source: `file:${file.filename}`,
          });
        }
      }
    }

    return {
      ok: true,
      data: { detected },
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
        message: error instanceof Error ? error.message : 'Unknown error during license detection',
        details: error instanceof Error ? { stack: error.stack } : {},
      },
      meta: {
        retrieved_at: now,
      },
    };
  }
}
