import { describe, it, expect } from 'vitest';
import { AssetSchema, CreateAssetSchema, VerifyAssetSchema } from './asset';

describe('Asset Schema', () => {
  describe('AssetSchema', () => {
    it('should validate a complete asset', () => {
      const asset = {
        _id: '507f1f77bcf86cd799439011',
        type: 'domain',
        fqdn: 'example.com',
        active: true,
        ip: ['192.168.1.1', '2001:db8::1'],
        owner: 'user@example.com',
        verifiedAt: new Date(),
        consentToken: 'abc123',
        metadata: { source: 'manual' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = AssetSchema.safeParse(asset);
      expect(result.success).toBe(true);
    });

    it('should validate minimal asset', () => {
      const asset = {
        type: 'subdomain',
        fqdn: 'sub.example.com',
      };

      const result = AssetSchema.safeParse(asset);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.active).toBe(true); // Default value
        expect(result.data.ip).toEqual([]); // Default value
      }
    });

    it('should reject invalid IP addresses', () => {
      const asset = {
        type: 'domain',
        fqdn: 'example.com',
        ip: ['not-an-ip'],
      };

      const result = AssetSchema.safeParse(asset);
      expect(result.success).toBe(false);
    });

    it('should accept both IPv4 and IPv6', () => {
      const asset = {
        type: 'ip',
        ip: ['192.168.1.1', '10.0.0.1', '2001:db8::1', 'fe80::1'],
      };

      const result = AssetSchema.safeParse(asset);
      expect(result.success).toBe(true);
    });
  });

  describe('CreateAssetSchema', () => {
    it('should validate domain creation', () => {
      const createAsset = {
        type: 'domain',
        fqdn: 'example.com',
        owner: 'user@example.com',
        verify: 'dns',
      };

      const result = CreateAssetSchema.safeParse(createAsset);
      expect(result.success).toBe(true);
    });

    it('should validate subdomain creation', () => {
      const createAsset = {
        type: 'subdomain',
        fqdn: 'api.example.com',
        parentFqdn: 'example.com',
      };

      const result = CreateAssetSchema.safeParse(createAsset);
      expect(result.success).toBe(true);
    });

    it('should validate IP creation', () => {
      const createAsset = {
        type: 'ip',
        ip: ['192.168.1.1'],
      };

      const result = CreateAssetSchema.safeParse(createAsset);
      expect(result.success).toBe(true);
    });

    it('should accept both verification methods', () => {
      const methods = ['dns', 'http'];
      
      methods.forEach((method) => {
        const createAsset = {
          type: 'domain',
          fqdn: 'example.com',
          verify: method,
        };

        const result = CreateAssetSchema.safeParse(createAsset);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid verification method', () => {
      const createAsset = {
        type: 'domain',
        fqdn: 'example.com',
        verify: 'invalid',
      };

      const result = CreateAssetSchema.safeParse(createAsset);
      expect(result.success).toBe(false);
    });
  });

  describe('VerifyAssetSchema', () => {
    it('should validate DNS verification', () => {
      const verify = {
        domain: 'example.com',
        method: 'dns',
        token: 'pablos-verify-abc123',
      };

      const result = VerifyAssetSchema.safeParse(verify);
      expect(result.success).toBe(true);
    });

    it('should validate HTTP verification', () => {
      const verify = {
        domain: 'example.com',
        method: 'http',
        token: 'abc123',
      };

      const result = VerifyAssetSchema.safeParse(verify);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const verify = {
        domain: 'example.com',
      };

      const result = VerifyAssetSchema.safeParse(verify);
      expect(result.success).toBe(false);
    });

    it('should reject empty domain', () => {
      const verify = {
        domain: '',
        method: 'dns',
        token: 'abc123',
      };

      const result = VerifyAssetSchema.safeParse(verify);
      expect(result.success).toBe(false);
    });

    it('should reject invalid verification method', () => {
      const verify = {
        domain: 'example.com',
        method: 'invalid',
        token: 'abc123',
      };

      const result = VerifyAssetSchema.safeParse(verify);
      expect(result.success).toBe(false);
    });
  });
});

