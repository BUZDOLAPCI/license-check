import { describe, it, expect } from 'vitest';
import { detectLicenses } from '../../src/tools/detect.js';
import { checkCompatibility } from '../../src/tools/compat.js';
import { generateNotice } from '../../src/tools/notice.js';

describe('detect_licenses', () => {
  describe('from dependencies with license_id', () => {
    it('should detect known SPDX license identifiers', async () => {
      const result = await detectLicenses({
        dependencies: [
          { name: 'lodash', version: '4.17.21', license_id: 'MIT' },
          { name: 'express', version: '4.18.2', license_id: 'Apache-2.0' },
        ],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.detected).toHaveLength(2);
        expect(result.data.detected[0]).toMatchObject({
          name: 'lodash',
          version: '4.17.21',
          license_id: 'MIT',
          confidence: 'high',
          source: 'dependency_metadata',
        });
        expect(result.data.detected[1]).toMatchObject({
          name: 'express',
          version: '4.18.2',
          license_id: 'Apache-2.0',
          confidence: 'high',
          source: 'dependency_metadata',
        });
      }
    });

    it('should normalize license aliases', async () => {
      const result = await detectLicenses({
        dependencies: [
          { name: 'pkg1', license_id: 'MIT License' },
          { name: 'pkg2', license_id: 'Apache License 2.0' },
          { name: 'pkg3', license_id: 'GPLv3' },
        ],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.detected[0]?.license_id).toBe('MIT');
        expect(result.data.detected[1]?.license_id).toBe('Apache-2.0');
        expect(result.data.detected[2]?.license_id).toBe('GPL-3.0-only');
      }
    });

    it('should handle unknown licenses with medium confidence', async () => {
      const result = await detectLicenses({
        dependencies: [{ name: 'custom-pkg', license_id: 'CustomLicense-1.0' }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.detected[0]).toMatchObject({
          license_id: 'CustomLicense-1.0',
          confidence: 'medium',
        });
      }
    });
  });

  describe('from dependencies with license_text', () => {
    it('should detect MIT license from text', async () => {
      const mitText = `MIT License

Copyright (c) 2024 Test Author

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software.`;

      const result = await detectLicenses({
        dependencies: [{ name: 'test-pkg', license_text: mitText }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.detected[0]).toMatchObject({
          license_id: 'MIT',
          confidence: 'high',
          source: 'license_text_analysis',
        });
      }
    });

    it('should detect Apache-2.0 license from text', async () => {
      const apacheText = `Apache License, Version 2.0

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.`;

      const result = await detectLicenses({
        dependencies: [{ name: 'apache-pkg', license_text: apacheText }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.detected[0]?.license_id).toBe('Apache-2.0');
        expect(result.data.detected[0]?.confidence).toBe('high');
      }
    });

    it('should return UNKNOWN for unrecognized text with warning', async () => {
      const result = await detectLicenses({
        dependencies: [{ name: 'mystery-pkg', license_text: 'Some custom license terms here.' }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.detected[0]?.license_id).toBe('UNKNOWN');
        expect(result.data.detected[0]?.confidence).toBe('low');
        expect(result.meta.warnings).toContain(
          'Could not detect license for mystery-pkg from provided text'
        );
      }
    });
  });

  describe('from files', () => {
    it('should detect license from LICENSE file content', async () => {
      const bsd3Text = `BSD 3-Clause License

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice.
2. Redistributions in binary form must reproduce the above copyright notice.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software.`;

      const result = await detectLicenses({
        files: [{ filename: 'LICENSE', content: bsd3Text }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.detected[0]).toMatchObject({
          name: 'LICENSE',
          license_id: 'BSD-3-Clause',
          confidence: 'high',
          source: 'file:LICENSE',
        });
      }
    });

    it('should detect ISC license', async () => {
      const iscText = `ISC License

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.`;

      const result = await detectLicenses({
        files: [{ filename: 'LICENSE.md', content: iscText }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.detected[0]?.license_id).toBe('ISC');
      }
    });
  });

  describe('error handling', () => {
    it('should return error for missing input', async () => {
      const result = await detectLicenses({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('should return error for invalid dependency input', async () => {
      const result = await detectLicenses({
        dependencies: [{ name: '' }],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });
  });
});

describe('check_compatibility', () => {
  describe('allowed list (whitelist)', () => {
    it('should pass when all licenses are in allowed list', async () => {
      const result = await checkCompatibility({
        licenses: [
          { name: 'lodash', license_id: 'MIT' },
          { name: 'express', license_id: 'MIT' },
        ],
        policy: {
          allowed: ['MIT', 'Apache-2.0', 'ISC'],
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.compatible).toBe(true);
        expect(result.data.violations).toHaveLength(0);
      }
    });

    it('should fail when a license is not in allowed list', async () => {
      const result = await checkCompatibility({
        licenses: [
          { name: 'lodash', license_id: 'MIT' },
          { name: 'gpl-pkg', license_id: 'GPL-3.0-only' },
        ],
        policy: {
          allowed: ['MIT', 'Apache-2.0'],
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.compatible).toBe(false);
        expect(result.data.violations).toHaveLength(1);
        expect(result.data.violations[0]).toMatchObject({
          name: 'gpl-pkg',
          license_id: 'GPL-3.0-only',
          reason: 'License "GPL-3.0-only" is not in the allowed list',
        });
      }
    });
  });

  describe('denied list (blacklist)', () => {
    it('should fail when a license is in denied list', async () => {
      const result = await checkCompatibility({
        licenses: [
          { name: 'safe-pkg', license_id: 'MIT' },
          { name: 'bad-pkg', license_id: 'GPL-3.0-only' },
        ],
        policy: {
          denied: ['GPL-3.0-only', 'AGPL-3.0-only'],
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.compatible).toBe(false);
        expect(result.data.violations).toHaveLength(1);
        expect(result.data.violations[0]?.license_id).toBe('GPL-3.0-only');
      }
    });

    it('should pass when no licenses are in denied list', async () => {
      const result = await checkCompatibility({
        licenses: [
          { name: 'pkg1', license_id: 'MIT' },
          { name: 'pkg2', license_id: 'Apache-2.0' },
        ],
        policy: {
          denied: ['GPL-3.0-only'],
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.compatible).toBe(true);
      }
    });
  });

  describe('copyleft_ok policy', () => {
    it('should fail copyleft licenses when copyleft_ok is false', async () => {
      const result = await checkCompatibility({
        licenses: [
          { name: 'gpl-pkg', license_id: 'GPL-3.0-only' },
          { name: 'lgpl-pkg', license_id: 'LGPL-3.0-only' },
          { name: 'mit-pkg', license_id: 'MIT' },
        ],
        policy: {
          copyleft_ok: false,
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.compatible).toBe(false);
        expect(result.data.violations).toHaveLength(2);
        expect(result.data.violations.map((v) => v.license_id)).toContain('GPL-3.0-only');
        expect(result.data.violations.map((v) => v.license_id)).toContain('LGPL-3.0-only');
      }
    });

    it('should allow copyleft licenses when copyleft_ok is true', async () => {
      const result = await checkCompatibility({
        licenses: [{ name: 'gpl-pkg', license_id: 'GPL-3.0-only' }],
        policy: {
          copyleft_ok: true,
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.compatible).toBe(true);
      }
    });
  });

  describe('UNKNOWN licenses', () => {
    it('should fail UNKNOWN license when using allowed list', async () => {
      const result = await checkCompatibility({
        licenses: [{ name: 'unknown-pkg', license_id: 'UNKNOWN' }],
        policy: {
          allowed: ['MIT'],
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.compatible).toBe(false);
        expect(result.data.violations[0]?.reason).toContain('Unknown license');
      }
    });

    it('should warn about UNKNOWN license when no allowed list', async () => {
      const result = await checkCompatibility({
        licenses: [{ name: 'unknown-pkg', license_id: 'UNKNOWN' }],
        policy: {},
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.compatible).toBe(true);
        expect(result.data.warnings).toContain(
          'License for unknown-pkg is UNKNOWN - manual review recommended'
        );
      }
    });
  });

  describe('error handling', () => {
    it('should return error for empty licenses array', async () => {
      const result = await checkCompatibility({
        licenses: [],
        policy: {},
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });
  });
});

describe('generate_notice', () => {
  it('should generate NOTICE file with all licenses grouped', async () => {
    const result = await generateNotice({
      licenses: [
        { name: 'lodash', version: '4.17.21', license_id: 'MIT', copyright: 'Copyright JS Foundation' },
        { name: 'express', version: '4.18.2', license_id: 'MIT', copyright: 'Copyright TJ Holowaychuk' },
        { name: 'zod', version: '3.22.4', license_id: 'MIT' },
        { name: 'typescript', version: '5.3.2', license_id: 'Apache-2.0', copyright: 'Copyright Microsoft' },
      ],
      project_name: 'MyProject',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const text = result.data.notice_text;

      // Check header
      expect(text).toContain('NOTICE file for MyProject');
      expect(text).toContain('Generated on:');

      // Check MIT section (3 packages)
      expect(text).toContain('MIT License (MIT)');
      expect(text).toContain('lodash@4.17.21');
      expect(text).toContain('Copyright JS Foundation');
      expect(text).toContain('express@4.18.2');
      expect(text).toContain('zod@3.22.4');

      // Check Apache section (1 package)
      expect(text).toContain('Apache License 2.0 (Apache-2.0)');
      expect(text).toContain('typescript@5.3.2');
      expect(text).toContain('Copyright Microsoft');

      // Check footer
      expect(text).toContain('END OF NOTICE FILE');
    }
  });

  it('should generate NOTICE without project name', async () => {
    const result = await generateNotice({
      licenses: [{ name: 'pkg', version: '1.0.0', license_id: 'MIT' }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.notice_text).toContain('NOTICE file');
      expect(result.data.notice_text).not.toContain('NOTICE file for');
    }
  });

  it('should include URL when provided', async () => {
    const result = await generateNotice({
      licenses: [
        {
          name: 'lodash',
          version: '4.17.21',
          license_id: 'MIT',
          url: 'https://github.com/lodash/lodash',
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.notice_text).toContain('URL: https://github.com/lodash/lodash');
    }
  });

  it('should warn about UNKNOWN licenses', async () => {
    const result = await generateNotice({
      licenses: [{ name: 'mystery', version: '1.0.0', license_id: 'UNKNOWN' }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meta.warnings).toContain(
        'Package "mystery" has unknown license - manual review required'
      );
    }
  });

  describe('error handling', () => {
    it('should return error for empty licenses array', async () => {
      const result = await generateNotice({
        licenses: [],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('should return error for missing package name', async () => {
      const result = await generateNotice({
        licenses: [{ name: '', license_id: 'MIT' }],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });
  });
});
