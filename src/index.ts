// Main entry point - exports all public APIs

export { createServer, startServer } from './server.js';
export { loadConfig, DEFAULT_CONFIG } from './config.js';
export { detectLicenses, checkCompatibility, generateNotice, toolDefinitions } from './tools/index.js';
export { createStdioTransport, createHttpTransport } from './transport/index.js';

// Re-export types
export type {
  // Response envelope types
  ApiResponse,
  SuccessResponse,
  ErrorResponse,
  ResponseMeta,

  // Detection types
  DetectLicensesInput,
  DetectLicensesOutput,
  DetectedLicense,
  DependencyInput,
  FileInput,
  ConfidenceLevel,

  // Compatibility types
  CheckCompatibilityInput,
  CheckCompatibilityOutput,
  CompatibilityPolicy,
  LicenseInfo,
  Violation,

  // Notice types
  GenerateNoticeInput,
  GenerateNoticeOutput,
  PackageLicense,

  // Server types
  ServerConfig,
  TransportType,
  ToolDefinition,
} from './types.js';

// Re-export Zod schemas for external validation
export {
  DetectLicensesInputSchema,
  CheckCompatibilityInputSchema,
  GenerateNoticeInputSchema,
  DependencyInputSchema,
  FileInputSchema,
  LicenseInfoSchema,
  CompatibilityPolicySchema,
  PackageLicenseSchema,
} from './types.js';

// Re-export configuration constants
export {
  SPDX_LICENSE_IDS,
  LICENSE_ALIASES,
  COPYLEFT_LICENSES,
  ATTRIBUTION_REQUIRED_LICENSES,
  LICENSE_PATTERNS,
} from './config.js';
