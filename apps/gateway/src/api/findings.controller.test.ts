import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { FindingsController } from './findings.controller';
import { Finding, Asset } from '../schemas';

describe('FindingsController', () => {
  let controller: FindingsController;
  let mockFindingModel: any;
  let mockAssetModel: any;

  beforeEach(async () => {
    mockFindingModel = {
      find: vi.fn().mockReturnThis(),
      findById: vi.fn().mockReturnThis(),
      countDocuments: vi.fn(),
      aggregate: vi.fn(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn(),
    };

    mockAssetModel = {
      findOne: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FindingsController],
      providers: [
        {
          provide: getModelToken(Finding.name),
          useValue: mockFindingModel,
        },
        {
          provide: getModelToken(Asset.name),
          useValue: mockAssetModel,
        },
      ],
    }).compile();

    controller = module.get<FindingsController>(FindingsController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('listFindings', () => {
    it('should return findings with default pagination', async () => {
      const mockFindings = [
        {
          _id: 'finding-1',
          severity: 'high',
          category: 'xss',
          provider: 'dirsearch',
          targetRef: 'asset-id-1',
          createdAt: new Date('2024-01-01'),
        },
      ];

      mockFindingModel.lean.mockResolvedValue(mockFindings);
      mockFindingModel.countDocuments.mockResolvedValue(1);

      const result = await controller.listFindings({});

      expect(result).toEqual({
        findings: mockFindings,
        total: 1,
        limit: 100,
        skip: 0,
      });
    });

    it('should filter by domain', async () => {
      const mockAsset = { _id: 'asset-id-123', fqdn: 'example.com' };
      mockAssetModel.findOne.mockResolvedValue(mockAsset);
      mockFindingModel.lean.mockResolvedValue([]);
      mockFindingModel.countDocuments.mockResolvedValue(0);

      const result = await controller.listFindings({ domain: 'example.com' });

      expect(mockAssetModel.findOne).toHaveBeenCalledWith({ fqdn: 'example.com' });
      expect(mockFindingModel.find).toHaveBeenCalledWith({ targetRef: 'asset-id-123' });
    });

    it('should return empty results when domain not found', async () => {
      mockAssetModel.findOne.mockResolvedValue(null);

      const result = await controller.listFindings({ domain: 'nonexistent.com' });

      expect(result).toEqual({ findings: [], total: 0 });
    });

    it('should filter by severity', async () => {
      mockFindingModel.lean.mockResolvedValue([]);
      mockFindingModel.countDocuments.mockResolvedValue(0);

      await controller.listFindings({ severity: 'high' });

      expect(mockFindingModel.find).toHaveBeenCalledWith({ severity: 'high' });
    });

    it('should filter by provider', async () => {
      mockFindingModel.lean.mockResolvedValue([]);
      mockFindingModel.countDocuments.mockResolvedValue(0);

      await controller.listFindings({ provider: 'dirsearch' });

      expect(mockFindingModel.find).toHaveBeenCalledWith({ provider: 'dirsearch' });
    });

    it('should filter by category', async () => {
      mockFindingModel.lean.mockResolvedValue([]);
      mockFindingModel.countDocuments.mockResolvedValue(0);

      await controller.listFindings({ category: 'WEB' });

      expect(mockFindingModel.find).toHaveBeenCalledWith({ category: 'WEB' });
    });

    it('should filter by since date', async () => {
      const sinceDate = new Date('2024-01-01');
      mockFindingModel.lean.mockResolvedValue([]);
      mockFindingModel.countDocuments.mockResolvedValue(0);

      await controller.listFindings({ since: sinceDate });

      expect(mockFindingModel.find).toHaveBeenCalledWith({
        createdAt: { $gte: sinceDate },
      });
    });

    it('should handle pagination with skip and limit', async () => {
      mockFindingModel.lean.mockResolvedValue([]);
      mockFindingModel.countDocuments.mockResolvedValue(100);

      const result = await controller.listFindings({ skip: 10, limit: 20 });

      expect(mockFindingModel.skip).toHaveBeenCalledWith(10);
      expect(mockFindingModel.limit).toHaveBeenCalledWith(20);
      expect(result.skip).toBe(10);
      expect(result.limit).toBe(20);
    });

    it('should combine multiple filters', async () => {
      const mockAsset = { _id: 'asset-id-123', fqdn: 'example.com' };
      mockAssetModel.findOne.mockResolvedValue(mockAsset);
      mockFindingModel.lean.mockResolvedValue([]);
      mockFindingModel.countDocuments.mockResolvedValue(0);

      await controller.listFindings({
        domain: 'example.com',
        severity: 'high',
        provider: 'dirsearch',
        category: 'WEB',
      });

      expect(mockFindingModel.find).toHaveBeenCalledWith({
        targetRef: 'asset-id-123',
        severity: 'high',
        provider: 'dirsearch',
        category: 'WEB',
      });
    });
  });

  describe('getStats', () => {
    it('should return stats for all findings', async () => {
      const mockStats = [
        { _id: 'high', count: 5 },
        { _id: 'medium', count: 10 },
        { _id: 'low', count: 3 },
      ];

      mockFindingModel.aggregate.mockResolvedValue(mockStats);

      const result = await controller.getStats();

      expect(result).toEqual({
        critical: 0,
        high: 5,
        medium: 10,
        low: 3,
        info: 0,
      });
    });

    it('should return stats for specific domain', async () => {
      const mockAsset = { _id: 'asset-id-123', fqdn: 'example.com' };
      mockAssetModel.findOne.mockResolvedValue(mockAsset);

      const mockStats = [
        { _id: 'critical', count: 2 },
        { _id: 'high', count: 5 },
      ];

      mockFindingModel.aggregate.mockResolvedValue(mockStats);

      const result = await controller.getStats('example.com');

      expect(mockAssetModel.findOne).toHaveBeenCalledWith({ fqdn: 'example.com' });
      expect(result).toEqual({
        critical: 2,
        high: 5,
        medium: 0,
        low: 0,
        info: 0,
      });
    });

    it('should return zero stats when domain not found', async () => {
      mockAssetModel.findOne.mockResolvedValue(null);
      mockFindingModel.aggregate.mockResolvedValue([]);

      const result = await controller.getStats('nonexistent.com');

      expect(result).toEqual({
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      });
    });

    it('should handle stats with unknown severity levels', async () => {
      const mockStats = [
        { _id: 'high', count: 5 },
        { _id: 'unknown', count: 2 }, // This should be ignored
      ];

      mockFindingModel.aggregate.mockResolvedValue(mockStats);

      const result = await controller.getStats();

      expect(result).toEqual({
        critical: 0,
        high: 5,
        medium: 0,
        low: 0,
        info: 0,
      });
    });

    it('should return all severity levels even when no findings exist', async () => {
      mockFindingModel.aggregate.mockResolvedValue([]);

      const result = await controller.getStats();

      expect(result).toEqual({
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      });
    });
  });

  describe('getFinding', () => {
    it('should return finding when found', async () => {
      const mockFinding = {
        _id: 'finding-id-123',
        severity: 'high',
        category: 'xss',
        provider: 'dirsearch',
        targetRef: 'asset-id-1',
        createdAt: new Date('2024-01-01'),
      };

      mockFindingModel.lean.mockResolvedValue(mockFinding);

      const result = await controller.getFinding('finding-id-123');

      expect(mockFindingModel.findById).toHaveBeenCalledWith('finding-id-123');
      expect(result).toEqual(mockFinding);
    });

    it('should throw 404 when finding not found', async () => {
      mockFindingModel.lean.mockResolvedValue(null);

      await expect(controller.getFinding('nonexistent-id')).rejects.toThrow(
        new HttpException('Finding not found', HttpStatus.NOT_FOUND)
      );

      expect(mockFindingModel.findById).toHaveBeenCalledWith('nonexistent-id');
    });
  });
});

