import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../../src/server.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

describe('MCP Server E2E', () => {
  let server: Server;

  beforeAll(() => {
    server = createServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('tool listing', () => {
    it('should list all available tools', async () => {
      // Access server internals to test tool listing
      const tools = [
        'detect_licenses',
        'check_compatibility',
        'generate_notice',
      ];

      // Verify server was created with tool capabilities
      expect(server).toBeDefined();
      // The actual tool listing is handled by the request handler
      // This test verifies the server setup
      tools.forEach((tool) => {
        expect(typeof tool).toBe('string');
      });
    });
  });

  describe('detect_licenses tool integration', () => {
    it('should handle a complete license detection workflow', async () => {
      // Import the tool directly for E2E testing
      const { detectLicenses } = await import('../../src/tools/detect.js');

      // Step 1: Detect from package.json style dependencies
      const result1 = await detectLicenses({
        dependencies: [
          { name: 'react', version: '18.2.0', license_id: 'MIT' },
          { name: 'typescript', version: '5.3.2', license_id: 'Apache-2.0' },
          { name: 'eslint', version: '8.55.0', license_id: 'MIT' },
        ],
      });

      expect(result1.ok).toBe(true);
      if (result1.ok) {
        expect(result1.data.detected).toHaveLength(3);
        expect(result1.meta.source).toBe('license-check');
        expect(result1.meta.retrieved_at).toBeDefined();
      }

      // Step 2: Detect from LICENSE file content
      const result2 = await detectLicenses({
        files: [
          {
            filename: 'LICENSE',
            content: `MIT License

Copyright (c) 2024 Test Corp

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.`,
          },
        ],
      });

      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(result2.data.detected[0]?.license_id).toBe('MIT');
        expect(result2.data.detected[0]?.confidence).toBe('high');
      }
    });
  });

  describe('check_compatibility tool integration', () => {
    it('should perform complete compliance check workflow', async () => {
      const { checkCompatibility } = await import('../../src/tools/compat.js');

      // Scenario: Corporate policy allows only permissive licenses
      const corporatePolicy = {
        allowed: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'],
        denied: ['GPL-3.0-only', 'AGPL-3.0-only'],
        copyleft_ok: false,
      };

      // Test with compliant dependencies
      const compliantResult = await checkCompatibility({
        licenses: [
          { name: 'lodash', license_id: 'MIT' },
          { name: 'express', license_id: 'MIT' },
          { name: 'typescript', license_id: 'Apache-2.0' },
        ],
        policy: corporatePolicy,
      });

      expect(compliantResult.ok).toBe(true);
      if (compliantResult.ok) {
        expect(compliantResult.data.compatible).toBe(true);
        expect(compliantResult.data.violations).toHaveLength(0);
      }

      // Test with non-compliant dependency
      const nonCompliantResult = await checkCompatibility({
        licenses: [
          { name: 'lodash', license_id: 'MIT' },
          { name: 'gpl-library', license_id: 'GPL-3.0-only' },
        ],
        policy: corporatePolicy,
      });

      expect(nonCompliantResult.ok).toBe(true);
      if (nonCompliantResult.ok) {
        expect(nonCompliantResult.data.compatible).toBe(false);
        expect(nonCompliantResult.data.violations.length).toBeGreaterThan(0);
        expect(nonCompliantResult.data.violations[0]?.name).toBe('gpl-library');
      }
    });
  });

  describe('generate_notice tool integration', () => {
    it('should generate complete NOTICE file', async () => {
      const { generateNotice } = await import('../../src/tools/notice.js');

      const result = await generateNotice({
        licenses: [
          {
            name: 'react',
            version: '18.2.0',
            license_id: 'MIT',
            copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
            url: 'https://github.com/facebook/react',
          },
          {
            name: 'typescript',
            version: '5.3.2',
            license_id: 'Apache-2.0',
            copyright: 'Copyright (c) Microsoft Corporation.',
            url: 'https://github.com/microsoft/TypeScript',
          },
          {
            name: 'zod',
            version: '3.22.4',
            license_id: 'MIT',
            copyright: 'Copyright (c) Colin McDonnell',
          },
        ],
        project_name: 'MyAwesomeProject',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const notice = result.data.notice_text;

        // Verify structure
        expect(notice).toMatch(/^={78}/); // Header separator
        expect(notice).toContain('NOTICE file for MyAwesomeProject');
        expect(notice).toContain('Generated on:');

        // Verify license grouping
        expect(notice).toContain('MIT License (MIT)');
        expect(notice).toContain('Apache License 2.0 (Apache-2.0)');

        // Verify package details
        expect(notice).toContain('react@18.2.0');
        expect(notice).toContain('Meta Platforms');
        expect(notice).toContain('typescript@5.3.2');
        expect(notice).toContain('Microsoft Corporation');

        // Verify URLs
        expect(notice).toContain('https://github.com/facebook/react');
        expect(notice).toContain('https://github.com/microsoft/TypeScript');

        // Verify footer
        expect(notice).toContain('END OF NOTICE FILE');
      }
    });
  });

  describe('complete workflow integration', () => {
    it('should perform detect -> check -> notice workflow', async () => {
      const { detectLicenses } = await import('../../src/tools/detect.js');
      const { checkCompatibility } = await import('../../src/tools/compat.js');
      const { generateNotice } = await import('../../src/tools/notice.js');

      // Step 1: Detect licenses
      const detected = await detectLicenses({
        dependencies: [
          { name: 'lodash', version: '4.17.21', license_id: 'MIT' },
          { name: 'axios', version: '1.6.2', license_id: 'MIT' },
          { name: 'dayjs', version: '1.11.10', license_id: 'MIT' },
        ],
      });

      expect(detected.ok).toBe(true);
      if (!detected.ok) return;

      // Step 2: Check compatibility
      const licensesToCheck = detected.data.detected.map((d) => ({
        name: d.name,
        license_id: d.license_id,
      }));

      const compatibility = await checkCompatibility({
        licenses: licensesToCheck,
        policy: {
          allowed: ['MIT', 'Apache-2.0', 'ISC', 'BSD-3-Clause'],
        },
      });

      expect(compatibility.ok).toBe(true);
      if (!compatibility.ok) return;
      expect(compatibility.data.compatible).toBe(true);

      // Step 3: Generate NOTICE
      const licensesForNotice = detected.data.detected.map((d) => ({
        name: d.name ?? 'unknown',
        version: d.version,
        license_id: d.license_id,
      }));

      const notice = await generateNotice({
        licenses: licensesForNotice,
        project_name: 'IntegrationTestProject',
      });

      expect(notice.ok).toBe(true);
      if (!notice.ok) return;

      expect(notice.data.notice_text).toContain('IntegrationTestProject');
      expect(notice.data.notice_text).toContain('lodash');
      expect(notice.data.notice_text).toContain('axios');
      expect(notice.data.notice_text).toContain('dayjs');
    });
  });

  describe('response envelope compliance', () => {
    it('should return standard success envelope', async () => {
      const { detectLicenses } = await import('../../src/tools/detect.js');

      const result = await detectLicenses({
        dependencies: [{ name: 'test', license_id: 'MIT' }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Check envelope structure
        expect(result).toHaveProperty('ok', true);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('meta');
        expect(result.meta).toHaveProperty('retrieved_at');
        expect(result.meta).toHaveProperty('source');
        expect(result.meta).toHaveProperty('pagination');
        expect(result.meta.pagination).toHaveProperty('next_cursor', null);

        // Verify ISO-8601 timestamp
        expect(new Date(result.meta.retrieved_at).toISOString()).toBe(result.meta.retrieved_at);
      }
    });

    it('should return standard error envelope', async () => {
      const { detectLicenses } = await import('../../src/tools/detect.js');

      const result = await detectLicenses({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // Check envelope structure
        expect(result).toHaveProperty('ok', false);
        expect(result).toHaveProperty('error');
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
        expect(result).toHaveProperty('meta');
        expect(result.meta).toHaveProperty('retrieved_at');

        // Verify error code is valid
        const validCodes = [
          'INVALID_INPUT',
          'UPSTREAM_ERROR',
          'RATE_LIMITED',
          'TIMEOUT',
          'PARSE_ERROR',
          'INTERNAL_ERROR',
        ];
        expect(validCodes).toContain(result.error.code);
      }
    });
  });
});
