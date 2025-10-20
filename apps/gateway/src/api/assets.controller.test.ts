import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { AssetsController } from './assets.controller';
import { Asset } from '../schemas';

describe('AssetsController', () => {
  let controller: AssetsController;
  let mockAssetModel: any;

  beforeEach(async () => {
    mockAssetModel = {
      find: vi.fn().mockReturnThis(),
      findOne: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetsController],
      providers: [
        {
          provide: getModelToken(Asset.name),
          useValue: mockAssetModel,
        },
      ],
    }).compile();

    controller = module.get<AssetsController>(AssetsController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getSubdomains', () => {
    it('should return active subdomains by default', async () => {
      const mockSubdomains = [
        {
          fqdn: 'api.example.com',
          active: true,
          ip: '1.2.3.4',
          verifiedAt: new Date('2024-01-01'),
        },
        {
          fqdn: 'www.example.com',
          active: true,
          ip: '1.2.3.5',
          verifiedAt: new Date('2024-01-02'),
        },
      ];

      mockAssetModel.lean.mockResolvedValue(mockSubdomains);

      const result = await controller.getSubdomains('example.com');

      expect(mockAssetModel.find).toHaveBeenCalledWith({
        parentFqdn: 'example.com',
        active: true,
      });
      expect(mockAssetModel.sort).toHaveBeenCalledWith({ fqdn: 1 });
      expect(result).toEqual({
        domain: 'example.com',
        subdomains: [
          {
            fqdn: 'api.example.com',
            active: true,
            ip: '1.2.3.4',
            verifiedAt: new Date('2024-01-01'),
          },
          {
            fqdn: 'www.example.com',
            active: true,
            ip: '1.2.3.5',
            verifiedAt: new Date('2024-01-02'),
          },
        ],
        total: 2,
      });
    });

    it('should return all subdomains when all=true', async () => {
      const mockSubdomains = [
        {
          fqdn: 'api.example.com',
          active: true,
          ip: '1.2.3.4',
          verifiedAt: new Date('2024-01-01'),
        },
        {
          fqdn: 'old.example.com',
          active: false,
          ip: '1.2.3.6',
          verifiedAt: null,
        },
      ];

      mockAssetModel.lean.mockResolvedValue(mockSubdomains);

      const result = await controller.getSubdomains('example.com', 'true');

      expect(mockAssetModel.find).toHaveBeenCalledWith({
        parentFqdn: 'example.com',
      });
      expect(result.total).toBe(2);
      expect(result.subdomains).toHaveLength(2);
    });

    it('should return empty array when no subdomains found', async () => {
      mockAssetModel.lean.mockResolvedValue([]);

      const result = await controller.getSubdomains('example.com');

      expect(result).toEqual({
        domain: 'example.com',
        subdomains: [],
        total: 0,
      });
    });

    it('should filter inactive subdomains when all is not true', async () => {
      const mockSubdomains = [
        {
          fqdn: 'api.example.com',
          active: true,
          ip: '1.2.3.4',
          verifiedAt: new Date('2024-01-01'),
        },
      ];

      mockAssetModel.lean.mockResolvedValue(mockSubdomains);

      const result = await controller.getSubdomains('example.com', 'false');

      expect(mockAssetModel.find).toHaveBeenCalledWith({
        parentFqdn: 'example.com',
        active: true,
      });
      expect(result.total).toBe(1);
    });
  });

  describe('getAsset', () => {
    it('should return asset when found', async () => {
      const mockAsset = {
        _id: 'asset-id-123',
        fqdn: 'example.com',
        active: true,
        ip: '1.2.3.4',
        verifiedAt: new Date('2024-01-01'),
        parentFqdn: null,
      };

      mockAssetModel.lean.mockResolvedValue(mockAsset);

      const result = await controller.getAsset('example.com');

      expect(mockAssetModel.findOne).toHaveBeenCalledWith({ fqdn: 'example.com' });
      expect(result).toEqual(mockAsset);
    });

    it('should throw 404 when asset not found', async () => {
      mockAssetModel.lean.mockResolvedValue(null);

      await expect(controller.getAsset('nonexistent.com')).rejects.toThrow(
        new HttpException('Asset not found', HttpStatus.NOT_FOUND)
      );

      expect(mockAssetModel.findOne).toHaveBeenCalledWith({ fqdn: 'nonexistent.com' });
    });

    it('should handle database errors', async () => {
      mockAssetModel.lean.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.getAsset('example.com')).rejects.toThrow('Database connection failed');
    });
  });
});

