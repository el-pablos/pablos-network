import { describe, it, expect } from 'vitest';
import { FindingCreateSchema, CreateFindingSchema } from './finding';

describe('Finding Schema', () => {
  it('should validate a valid finding', () => {
    const validFinding = {
      targetRef: '507f1f77bcf86cd799439011',
      targetFqdn: 'example.com',
      provider: 'dns',
      category: 'DNS',
      severity: 'high',
      title: 'Subdomain Takeover Risk',
      description: 'Dangling CNAME record detected',
      fingerprint: 'dns:example.com:cname:dangling',
      metadata: {
        record: 'CNAME',
        value: 'old-service.example.com',
      },
    };

    const result = CreateFindingSchema.safeParse(validFinding);
    expect(result.success).toBe(true);

    // Test backward compatibility alias
    const result2 = FindingCreateSchema.safeParse(validFinding);
    expect(result2.success).toBe(true);
  });

  it('should reject finding with invalid severity', () => {
    const invalidFinding = {
      targetRef: '507f1f77bcf86cd799439011',
      targetFqdn: 'example.com',
      provider: 'dns',
      category: 'DNS',
      severity: 'invalid',
      title: 'Test Finding',
      description: 'Test description',
      fingerprint: 'test:fingerprint',
    };

    const result = CreateFindingSchema.safeParse(invalidFinding);
    expect(result.success).toBe(false);
  });

  it('should reject finding without required fields', () => {
    const invalidFinding = {
      targetFqdn: 'example.com',
      severity: 'high',
    };

    const result = CreateFindingSchema.safeParse(invalidFinding);
    expect(result.success).toBe(false);
  });

  it('should accept finding with evidence reference', () => {
    const findingWithEvidence = {
      targetRef: '507f1f77bcf86cd799439011',
      targetFqdn: 'example.com',
      provider: 'dirsearch',
      category: 'WEB',
      severity: 'medium',
      title: 'Sensitive File Exposed',
      description: 'Found .env file in web root',
      fingerprint: 'dirsearch:example.com:file:.env',
      evidenceFileId: '507f1f77bcf86cd799439012',
    };

    const result = CreateFindingSchema.safeParse(findingWithEvidence);
    expect(result.success).toBe(true);
  });

  it('should accept all valid severity levels', () => {
    const severities = ['critical', 'high', 'medium', 'low', 'info'];

    severities.forEach((severity) => {
      const finding = {
        targetRef: '507f1f77bcf86cd799439011',
        targetFqdn: 'example.com',
        provider: 'dns',
        category: 'DNS',
        severity,
        title: 'Test Finding',
        description: 'Test description',
        fingerprint: `test:${severity}`,
      };

      const result = CreateFindingSchema.safeParse(finding);
      expect(result.success).toBe(true);
    });
  });
});

