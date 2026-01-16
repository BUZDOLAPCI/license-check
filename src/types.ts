import { z } from 'zod';

// =============================================================================
// Standard Response Envelope Types
// =============================================================================

export interface ResponseMeta {
  source?: string;
  retrieved_at: string;
  pagination?: {
    next_cursor: string | null;
  };
  warnings?: string[];
}

export interface SuccessResponse<T> {
  ok: true;
  data: T;
  meta: ResponseMeta;
}

export interface ErrorResponse {
  ok: false;
  error: {
    code:
      | 'INVALID_INPUT'
      | 'UPSTREAM_ERROR'
      | 'RATE_LIMITED'
      | 'TIMEOUT'
      | 'PARSE_ERROR'
      | 'INTERNAL_ERROR';
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    retrieved_at: string;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// =============================================================================
// License Detection Types
// =============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface DependencyInput {
  name: string;
  version?: string;
  license_text?: string;
  license_id?: string;
}

export interface FileInput {
  filename: string;
  content: string;
}

export interface DetectedLicense {
  name?: string;
  version?: string;
  license_id: string;
  confidence: ConfidenceLevel;
  source: string;
}

export interface DetectLicensesInput {
  dependencies?: DependencyInput[];
  files?: FileInput[];
}

export interface DetectLicensesOutput {
  detected: DetectedLicense[];
}

// =============================================================================
// Compatibility Check Types
// =============================================================================

export interface LicenseInfo {
  name?: string;
  license_id: string;
}

export interface CompatibilityPolicy {
  allowed?: string[];
  denied?: string[];
  copyleft_ok?: boolean;
  required_attribution?: string[];
}

export interface Violation {
  name?: string;
  license_id: string;
  reason: string;
}

export interface CheckCompatibilityInput {
  licenses: LicenseInfo[];
  policy: CompatibilityPolicy;
}

export interface CheckCompatibilityOutput {
  compatible: boolean;
  violations: Violation[];
  warnings: string[];
}

// =============================================================================
// Notice Generation Types
// =============================================================================

export interface PackageLicense {
  name: string;
  version?: string;
  license_id: string;
  copyright?: string;
  url?: string;
}

export interface GenerateNoticeInput {
  licenses: PackageLicense[];
  project_name?: string;
}

export interface GenerateNoticeOutput {
  notice_text: string;
}

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

export const DependencyInputSchema = z.object({
  name: z.string().min(1, 'Package name is required'),
  version: z.string().optional(),
  license_text: z.string().optional(),
  license_id: z.string().optional(),
});

export const FileInputSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  content: z.string().min(1, 'File content is required'),
});

export const DetectLicensesInputSchema = z
  .object({
    dependencies: z.array(DependencyInputSchema).optional(),
    files: z.array(FileInputSchema).optional(),
  })
  .refine((data) => data.dependencies || data.files, {
    message: 'Either dependencies or files must be provided',
  });

export const LicenseInfoSchema = z.object({
  name: z.string().optional(),
  license_id: z.string().min(1, 'License ID is required'),
});

export const CompatibilityPolicySchema = z.object({
  allowed: z.array(z.string()).optional(),
  denied: z.array(z.string()).optional(),
  copyleft_ok: z.boolean().optional(),
  required_attribution: z.array(z.string()).optional(),
});

export const CheckCompatibilityInputSchema = z.object({
  licenses: z.array(LicenseInfoSchema).min(1, 'At least one license is required'),
  policy: CompatibilityPolicySchema,
});

export const PackageLicenseSchema = z.object({
  name: z.string().min(1, 'Package name is required'),
  version: z.string().optional(),
  license_id: z.string().min(1, 'License ID is required'),
  copyright: z.string().optional(),
  url: z.string().url().optional(),
});

export const GenerateNoticeInputSchema = z.object({
  licenses: z.array(PackageLicenseSchema).min(1, 'At least one license is required'),
  project_name: z.string().optional(),
});

// =============================================================================
// Server Configuration Types
// =============================================================================

export interface ServerConfig {
  port: number;
  host: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// =============================================================================
// MCP Tool Definition Types
// =============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  handler: (input: unknown) => Promise<ApiResponse<unknown>>;
}
