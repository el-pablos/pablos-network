import { describe, it, expect } from 'vitest';
import { EvidenceSchema, EvidenceMetadataSchema } from './evidence';

describe('Evidence Schema', () => {
  describe('EvidenceMetadataSchema', () => {
    it('should validate complete metadata', () => {
      const metadata = {
        findingId: '507f1f77bcf86cd799439011',
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        targetFqdn: 'example.com',
        contentType: 'image/png',
        filename: 'screenshot.png',
        size: 1024000,
        hash: 'sha256:abc123',
        source: 'zap',
        uploadedAt: new Date(),
      };

      const result = EvidenceMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    });

    it('should validate minimal metadata', () => {
      const metadata = {
        filename: 'evidence.txt',
      };

      const result = EvidenceMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contentType).toBe('application/octet-stream'); // Default
      }
    });

    it('should reject missing filename', () => {
      const metadata = {
        contentType: 'text/plain',
      };

      const result = EvidenceMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(false);
    });

    it('should validate GridFS file ID', () => {
      const metadata = {
        findingId: '507f1f77bcf86cd799439011',
        filename: 'report.pdf',
      };

      const result = EvidenceMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    });
  });

  describe('EvidenceSchema', () => {
    it('should validate GridFS evidence', () => {
      const evidence = {
        _id: '507f1f77bcf86cd799439011',
        length: 1024000,
        chunkSize: 261120,
        uploadDate: new Date(),
        filename: 'screenshot.png',
        metadata: {
          filename: 'screenshot.png',
          contentType: 'image/png',
          findingId: '507f1f77bcf86cd799439012',
        },
      };

      const result = EvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(true);
    });

    it('should validate evidence without metadata', () => {
      const evidence = {
        _id: '507f1f77bcf86cd799439011',
        length: 512,
        chunkSize: 261120,
        uploadDate: new Date(),
        filename: 'data.bin',
      };

      const result = EvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(true);
    });

    it('should require all GridFS fields', () => {
      const evidence = {
        _id: '507f1f77bcf86cd799439011',
        filename: 'test.txt',
      };

      const result = EvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(false);
    });
  });
});

