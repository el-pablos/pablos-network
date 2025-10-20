import { describe, it, expect } from 'vitest';
import { FindingSchema, FindingCreateSchema } from './finding';

describe('Finding Schema', () => {
  it('should validate a valid finding', () => {
    const validFinding = {
      targetRef: '507f1f77bcf86cd799439011',
      targetFqdn: 'example.com',
      provider: 'dns',
      severity: 'high',
      title: 'Subdomain Takeover Risk',
      description: 'Dangling CNAME record detected',
      fingerprint: 'dns:example.com:cname:dangling',
      metadata: {
        record: 'CNAME',
        value: 'old-service.example.com',
      },
    };

    const result = FindingCreateSchema.safeParse(validFinding);
    expect(result.success).toBe(true);
  });

  it('should reject finding with invalid severity', () => {
    const invalidFinding = {
      targetRef: '507f1f77bcf86cd799439011',
      targetFqdn: 'example.com',
      provider: 'dns',
      severity: 'invalid',
      title: 'Test Finding',
      description: 'Test description',
      fingerprint: 'test:fingerprint',
    };

    const result = FindingCreateSchema.safeParse(invalidFinding);
    expect(result.success).toBe(false);
  });

  it('should reject finding without required fields', () => {
    const invalidFinding = {
      targetFqdn: 'example.com',
      severity: 'high',
    };

    const result = FindingCreateSchema.safeParse(invalidFinding);
    expect(result.success).toBe(false);
  });

  it('should accept finding with evidence reference', () => {
    const findingWithEvidence = {
      targetRef: '507f1f77bcf86cd799439011',
      targetFqdn: 'example.com',
      provider: 'webdiscovery',
      severity: 'medium',
      title: 'Sensitive File Exposed',
      description: 'Found .env file in web root',
      fingerprint: 'webdiscovery:example.com:file:.env',
      evidenceRef: '507f1f77bcf86cd799439012',
    };

    const result = FindingCreateSchema.safeParse(findingWithEvidence);
    expect(result.success).toBe(true);
  });

  it('should accept all valid severity levels', () => {
    const severities = ['critical', 'high', 'medium', 'low', 'info'];
    
    severities.forEach((severity) => {
      const finding = {
        targetRef: '507f1f77bcf86cd799439011',
        targetFqdn: 'example.com',
        provider: 'test',
        severity,
        title: 'Test Finding',
        description: 'Test description',
        fingerprint: `test:${severity}`,
      };

      const result = FindingCreateSchema.safeParse(finding);
      expect(result.success).toBe(true);
    });
  });
});

