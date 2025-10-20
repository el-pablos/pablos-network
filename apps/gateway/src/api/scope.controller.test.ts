import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { ScopeController } from './scope.controller';
import { Asset, AuditLog } from '../schemas';

// Mock utils
vi.mock('@pablos/utils', async () => {
  const actual = await vi.importActual('@pablos/utils');
  return {
    ...actual,
    generateConsentToken: vi.fn(() => 'mock-token-123'),
    createLogger: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  };
});

describe('ScopeController', () => {
  let controller: ScopeController;
  let assetModel: any;
  let auditModel: any;

  beforeEach(async () => {
    // Mock Asset model
    assetModel = {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    // Mock AuditLog model
    auditModel = {
      create: vi.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScopeController],
      providers: [
        {
          provide: getModelToken(Asset.name),
          useValue: function (data: any) {
            return {
              ...data,
              _id: 'mock-asset-id',
              save: vi.fn().mockResolvedValue({ ...data, _id: 'mock-asset-id' }),
            };
          },
        },
        {
          provide: getModelToken(AuditLog.name),
          useValue: auditModel,
        },
      ],
    }).compile();

    controller = module.get<ScopeController>(ScopeController);
    
    // Override the model instance
    (controller as any).assetModel = assetModel;
    (controller as any).auditModel = auditModel;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('addToScope', () => {
    it('should add new asset to scope with DNS verification', async () => {
      assetModel.findOne.mockResolvedValue(null);
      
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        type: 'domain',
        consentToken: 'mock-token-123',
        save: vi.fn().mockResolvedValue({}),
      };
      
      (controller as any).assetModel = function (data: any) {
        return { ...mockAsset, ...data };
      };
      (controller as any).assetModel.findOne = assetModel.findOne;

      const result = await controller.addToScope({
        fqdn: 'example.com',
        type: 'domain',
        verify: 'dns',
      });

      expect(result.asset.fqdn).toBe('example.com');
      expect(result.verification.method).toBe('dns');
      expect(result.verification.record).toContain('_pablos-verify.example.com');
      expect(auditModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'scope:add',
          target: 'example.com',
        })
      );
    });

    it('should add new asset to scope with HTTP verification', async () => {
      assetModel.findOne.mockResolvedValue(null);
      
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        type: 'domain',
        consentToken: 'mock-token-123',
        save: vi.fn().mockResolvedValue({}),
      };
      
      (controller as any).assetModel = function (data: any) {
        return { ...mockAsset, ...data };
      };
      (controller as any).assetModel.findOne = assetModel.findOne;

      const result = await controller.addToScope({
        fqdn: 'example.com',
        type: 'domain',
        verify: 'http',
      });

      expect(result.verification.method).toBe('http');
      expect(result.verification.instructions).toContain('.well-known/pablos-proof.txt');
      expect(result.verification.content).toBe('mock-token-123');
    });

    it('should throw conflict error if asset already exists', async () => {
      assetModel.findOne.mockResolvedValue({
        _id: 'existing-id',
        fqdn: 'example.com',
      });

      await expect(
        controller.addToScope({
          fqdn: 'example.com',
          type: 'domain',
        })
      ).rejects.toThrow(HttpException);
    });

    it('should throw error for invalid input', async () => {
      await expect(
        controller.addToScope({
          fqdn: '', // Invalid empty FQDN
          type: 'domain',
        })
      ).rejects.toThrow();
    });
  });

  describe('verifyOwnership', () => {
    it('should verify asset with correct token', async () => {
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        consentToken: 'correct-token',
        verifiedAt: null,
        save: vi.fn().mockResolvedValue({}),
      };

      assetModel.findOne.mockResolvedValue(mockAsset);

      const result = await controller.verifyOwnership({
        domain: 'example.com',
        method: 'dns',
        token: 'correct-token',
      });

      expect(result.verified).toBe(true);
      expect(mockAsset.save).toHaveBeenCalled();
      expect(mockAsset.verifiedAt).toBeInstanceOf(Date);
      expect(auditModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'scope:verify',
          target: 'example.com',
        })
      );
    });

    it('should return already verified for verified asset', async () => {
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        consentToken: 'token',
        verifiedAt: new Date(),
        save: vi.fn(),
      };

      assetModel.findOne.mockResolvedValue(mockAsset);

      const result = await controller.verifyOwnership({
        domain: 'example.com',
        method: 'dns',
        token: 'token',
      });

      expect(result.verified).toBe(true);
      expect(result.message).toBe('Already verified');
      expect(mockAsset.save).not.toHaveBeenCalled();
    });

    it('should throw error for non-existent asset', async () => {
      assetModel.findOne.mockResolvedValue(null);

      await expect(
        controller.verifyOwnership({
          domain: 'nonexistent.com',
          method: 'dns',
          token: 'token',
        })
      ).rejects.toThrow(HttpException);
    });

    it('should throw error for incorrect token', async () => {
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        consentToken: 'correct-token',
        verifiedAt: null,
      };

      assetModel.findOne.mockResolvedValue(mockAsset);

      await expect(
        controller.verifyOwnership({
          domain: 'example.com',
          method: 'dns',
          token: 'wrong-token',
        })
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getAsset', () => {
    it('should return asset by domain', async () => {
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        type: 'domain',
        active: true,
      };

      assetModel.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockAsset),
      });

      const result = await controller.getAsset('example.com');

      expect(result).toEqual(mockAsset);
      expect(assetModel.findOne).toHaveBeenCalledWith({ fqdn: 'example.com' });
    });

    it('should throw error for non-existent asset', async () => {
      assetModel.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      await expect(controller.getAsset('nonexistent.com')).rejects.toThrow(HttpException);
    });
  });

  describe('listAssets', () => {
    it('should return all assets sorted by createdAt', async () => {
      const mockAssets = [
        { _id: '1', fqdn: 'example1.com', createdAt: new Date('2024-01-02') },
        { _id: '2', fqdn: 'example2.com', createdAt: new Date('2024-01-01') },
      ];

      assetModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockAssets),
        }),
      });

      const result = await controller.listAssets();

      expect(result).toEqual(mockAssets);
      expect(assetModel.find).toHaveBeenCalled();
    });

    it('should return empty array when no assets exist', async () => {
      assetModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await controller.listAssets();

      expect(result).toEqual([]);
    });
  });
});

