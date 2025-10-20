import { describe, it, expect } from 'vitest';
import { generateToken, hashString, generateFingerprint, generateConsentToken } from './crypto';

describe('Crypto Utils', () => {
  describe('generateToken', () => {
    it('should generate token with default length', () => {
      const token = generateToken();
      expect(token).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate token with custom length', () => {
      const token = generateToken(16);
      expect(token).toHaveLength(32); // 16 bytes = 32 hex characters
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('hashString', () => {
    it('should hash string with default algorithm (sha256)', () => {
      const hash = hashString('test');
      expect(hash).toHaveLength(64); // SHA256 = 64 hex characters
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce consistent hashes', () => {
      const hash1 = hashString('test');
      const hash2 = hashString('test');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashString('test1');
      const hash2 = hashString('test2');
      expect(hash1).not.toBe(hash2);
    });

    it('should support different algorithms', () => {
      const sha256 = hashString('test', 'sha256');
      const sha512 = hashString('test', 'sha512');
      expect(sha256).toHaveLength(64);
      expect(sha512).toHaveLength(128);
    });
  });

  describe('generateFingerprint', () => {
    it('should generate fingerprint from object', () => {
      const data = { provider: 'dns', domain: 'example.com', type: 'A' };
      const fingerprint = generateFingerprint(data);
      expect(fingerprint).toHaveLength(64);
      expect(fingerprint).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce consistent fingerprints', () => {
      const data = { provider: 'dns', domain: 'example.com' };
      const fp1 = generateFingerprint(data);
      const fp2 = generateFingerprint(data);
      expect(fp1).toBe(fp2);
    });

    it('should produce same fingerprint regardless of key order', () => {
      const data1 = { a: 1, b: 2, c: 3 };
      const data2 = { c: 3, a: 1, b: 2 };
      const fp1 = generateFingerprint(data1);
      const fp2 = generateFingerprint(data2);
      expect(fp1).toBe(fp2);
    });

    it('should produce different fingerprints for different data', () => {
      const data1 = { provider: 'dns', domain: 'example.com' };
      const data2 = { provider: 'dns', domain: 'test.com' };
      const fp1 = generateFingerprint(data1);
      const fp2 = generateFingerprint(data2);
      expect(fp1).not.toBe(fp2);
    });
  });

  describe('generateConsentToken', () => {
    it('should generate token with correct prefix', () => {
      const token = generateConsentToken();
      expect(token).toMatch(/^pablos-verify-[0-9a-f]{32}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateConsentToken();
      const token2 = generateConsentToken();
      expect(token1).not.toBe(token2);
    });
  });
});

