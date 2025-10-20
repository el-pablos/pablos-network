import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { ScanController } from './scan.controller';
import { Asset, Job, AuditLog } from '../schemas';
import { QueueService } from '../queue/queue.service';

// Mock utils
vi.mock('@pablos/utils', async () => {
  const actual = await vi.importActual('@pablos/utils');

  class MockVerificationRequiredError extends Error {
    constructor(domain: string) {
      super(`Domain ${domain} requires verification before active scanning`);
      this.name = 'VerificationRequiredError';
    }
  }

  return {
    ...actual,
    VerificationRequiredError: MockVerificationRequiredError,
    createLogger: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  };
});

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-123'),
}));

describe('ScanController', () => {
  let controller: ScanController;
  let assetModel: any;
  let jobModel: any;
  let auditModel: any;
  let queueService: any;

  beforeEach(async () => {
    // Mock models
    assetModel = {
      findOne: vi.fn(),
    };

    jobModel = function (data: any) {
      return {
        ...data,
        _id: 'mock-job-id',
        save: vi.fn().mockResolvedValue({ ...data, _id: 'mock-job-id' }),
      };
    };

    auditModel = {
      create: vi.fn().mockResolvedValue({}),
    };

    // Mock QueueService
    queueService = {
      addJob: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScanController],
      providers: [
        {
          provide: getModelToken(Asset.name),
          useValue: assetModel,
        },
        {
          provide: getModelToken(Job.name),
          useValue: jobModel,
        },
        {
          provide: getModelToken(AuditLog.name),
          useValue: auditModel,
        },
        {
          provide: QueueService,
          useValue: queueService,
        },
      ],
    }).compile();

    controller = module.get<ScanController>(ScanController);

    // Override model instances
    (controller as any).assetModel = assetModel;
    (controller as any).jobModel = jobModel;
    (controller as any).auditModel = auditModel;
    (controller as any).queueService = queueService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('scanPassive', () => {
    it('should start passive scan for existing asset', async () => {
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        type: 'domain',
      };

      assetModel.findOne.mockResolvedValue(mockAsset);

      const result = await controller.scanPassive({
        domain: 'example.com',
      });

      expect(result.jobs).toHaveLength(2);
      expect(queueService.addJob).toHaveBeenCalledTimes(2);
      expect(queueService.addJob).toHaveBeenCalledWith(
        'zoomEye',
        'mock-uuid-123',
        expect.objectContaining({
          assetId: 'mock-asset-id',
          domain: 'example.com',
        })
      );
    });

    it('should throw error for non-existent asset', async () => {
      assetModel.findOne.mockResolvedValue(null);

      await expect(
        controller.scanPassive({
          domain: 'nonexistent.com',
        })
      ).rejects.toThrow(HttpException);
    });

    it('should use default providers if none specified', async () => {
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        type: 'domain',
      };

      assetModel.findOne.mockResolvedValue(mockAsset);

      const result = await controller.scanPassive({
        domain: 'example.com',
      });

      // Default providers: zoomEye, binaryEdge
      expect(result.jobs).toHaveLength(2);
    });
  });

  describe('scanWeb', () => {
    it('should throw error for unverified asset', async () => {
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        verifiedAt: null, // Not verified
      };

      assetModel.findOne.mockResolvedValue(mockAsset);

      await expect(
        controller.scanWeb({
          domain: 'example.com',
        })
      ).rejects.toThrow('Domain example.com requires verification before active scanning');
    });

    it('should start web scan for verified asset', async () => {
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        verifiedAt: new Date(),
      };

      assetModel.findOne.mockResolvedValue(mockAsset);

      const result = await controller.scanWeb({
        domain: 'example.com',
      });

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].jobId).toBe('mock-uuid-123');
      expect(result.jobs[0].provider).toBe('dirsearch');
      expect(queueService.addJob).toHaveBeenCalledWith(
        'dirsearch',
        'mock-uuid-123',
        expect.objectContaining({
          assetId: 'mock-asset-id',
          domain: 'example.com',
        })
      );
      expect(auditModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'scan:web',
          target: 'example.com',
        })
      );
    });

    it('should throw error for non-existent asset', async () => {
      assetModel.findOne.mockResolvedValue(null);

      await expect(
        controller.scanWeb({
          domain: 'nonexistent.com',
        })
      ).rejects.toThrow(HttpException);
    });
  });

  describe('scanDast', () => {
    it('should throw error for unverified asset', async () => {
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        verifiedAt: null,
      };

      assetModel.findOne.mockResolvedValue(mockAsset);

      await expect(
        controller.scanDast({
          domain: 'example.com',
        })
      ).rejects.toThrow('Domain example.com requires verification before active scanning');
    });

    it('should start DAST scan for verified asset with default mode', async () => {
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        verifiedAt: new Date(),
      };

      assetModel.findOne.mockResolvedValue(mockAsset);

      const result = await controller.scanDast({
        domain: 'example.com',
      });

      expect(result.jobId).toBe('mock-uuid-123');
      expect(queueService.addJob).toHaveBeenCalledWith(
        'zap',
        'mock-uuid-123',
        expect.objectContaining({
          assetId: 'mock-asset-id',
          domain: 'example.com',
          mode: 'safe',
        })
      );
    });

    it('should start DAST scan with custom mode', async () => {
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        verifiedAt: new Date(),
      };

      assetModel.findOne.mockResolvedValue(mockAsset);

      const result = await controller.scanDast({
        domain: 'example.com',
        mode: 'baseline',
      });

      expect(queueService.addJob).toHaveBeenCalledWith(
        'zap',
        'mock-uuid-123',
        expect.objectContaining({
          mode: 'baseline',
        })
      );
    });
  });

  describe('requireVerification', () => {
    it('should throw 403 error for unverified asset', async () => {
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        verifiedAt: null,
      };

      assetModel.findOne.mockResolvedValue(mockAsset);

      await expect(
        (controller as any).requireVerification('example.com', 'dirsearch')
      ).rejects.toThrow('Domain example.com requires verification before active scanning');
    });

    it('should return asset for verified domain', async () => {
      const mockAsset = {
        _id: 'mock-asset-id',
        fqdn: 'example.com',
        verifiedAt: new Date(),
      };

      assetModel.findOne.mockResolvedValue(mockAsset);

      const result = await (controller as any).requireVerification('example.com', 'dirsearch');

      expect(result).toEqual(mockAsset);
    });
  });
});

