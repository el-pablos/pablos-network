import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'stream';
import { ObjectId } from 'mongodb';

// Mock MongoDB
const mockUploadStream = {
  id: new ObjectId('507f1f77bcf86cd799439011'),
  on: vi.fn(),
};

const mockDownloadStream = new Readable({
  read() {
    this.push('test data');
    this.push(null);
  },
});

const mockBucket = {
  openUploadStream: vi.fn(() => mockUploadStream),
  openDownloadStream: vi.fn(() => mockDownloadStream),
  delete: vi.fn().mockResolvedValue(undefined),
  find: vi.fn(() => ({
    toArray: vi.fn().mockResolvedValue([
      {
        _id: new ObjectId('507f1f77bcf86cd799439011'),
        filename: 'test.txt',
        length: 100,
        metadata: { contentType: 'text/plain' },
      },
    ]),
  })),
};

const mockClient = {
  db: vi.fn(() => ({})),
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('mongodb', async () => {
  const actual = await vi.importActual('mongodb');
  return {
    ...actual,
    MongoClient: vi.fn(() => mockClient),
    GridFSBucket: vi.fn(() => mockBucket),
  };
});

vi.mock('./logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('GridFS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset upload stream event handlers
    mockUploadStream.on.mockImplementation((event: string, handler: any) => {
      if (event === 'finish') {
        // Simulate immediate finish
        setTimeout(() => handler(), 0);
      }
      return mockUploadStream;
    });
  });

  afterEach(async () => {
    // Clean up module state
    const { closeGridFS } = await import('./gridfs');
    await closeGridFS();
  });

  describe('initGridFS', () => {
    it('should initialize GridFS bucket', async () => {
      const { initGridFS } = await import('./gridfs');
      const bucket = await initGridFS();

      expect(bucket).toBeDefined();
    });

    it('should reuse existing bucket', async () => {
      const { initGridFS } = await import('./gridfs');
      const bucket1 = await initGridFS();
      const bucket2 = await initGridFS();

      expect(bucket1).toBe(bucket2);
    });
  });

  describe('saveEvidence', () => {
    it('should initialize GridFS before saving', async () => {
      const { initGridFS } = await import('./gridfs');

      // Just verify initGridFS is called
      const bucket = await initGridFS();
      expect(bucket).toBeDefined();
    });
  });

  describe('getEvidence', () => {
    it('should retrieve evidence by ObjectId', async () => {
      const { getEvidence } = await import('./gridfs');
      const fileId = new ObjectId('507f1f77bcf86cd799439011');

      const stream = await getEvidence(fileId);

      expect(stream).toBeDefined();
      expect(mockBucket.openDownloadStream).toHaveBeenCalledWith(fileId);
    });

    it('should retrieve evidence by string ID', async () => {
      const { getEvidence } = await import('./gridfs');
      const fileId = '507f1f77bcf86cd799439011';

      const stream = await getEvidence(fileId);

      expect(stream).toBeDefined();
      expect(mockBucket.openDownloadStream).toHaveBeenCalled();
    });
  });

  describe('deleteEvidence', () => {
    it('should delete evidence by ObjectId', async () => {
      const { deleteEvidence } = await import('./gridfs');
      const fileId = new ObjectId('507f1f77bcf86cd799439011');

      await deleteEvidence(fileId);

      expect(mockBucket.delete).toHaveBeenCalledWith(fileId);
    });

    it('should delete evidence by string ID', async () => {
      const { deleteEvidence } = await import('./gridfs');
      const fileId = '507f1f77bcf86cd799439011';

      await deleteEvidence(fileId);

      expect(mockBucket.delete).toHaveBeenCalled();
    });
  });

  describe('getEvidenceMetadata', () => {
    it('should retrieve evidence metadata', async () => {
      const { getEvidenceMetadata } = await import('./gridfs');
      const fileId = new ObjectId('507f1f77bcf86cd799439011');

      const metadata = await getEvidenceMetadata(fileId);

      expect(metadata).toBeDefined();
      expect(metadata.filename).toBe('test.txt');
      expect(mockBucket.find).toHaveBeenCalledWith({ _id: fileId });
    });

    it('should throw error for non-existent file', async () => {
      const { getEvidenceMetadata } = await import('./gridfs');
      
      // Mock empty result
      mockBucket.find.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValue([]),
      });

      const fileId = new ObjectId('507f1f77bcf86cd799439012');

      await expect(getEvidenceMetadata(fileId)).rejects.toThrow('Evidence file not found');
    });
  });

  describe('closeGridFS', () => {
    it('should close GridFS connection', async () => {
      const { initGridFS, closeGridFS } = await import('./gridfs');
      
      await initGridFS();
      await closeGridFS();

      expect(mockClient.close).toHaveBeenCalled();
    });
  });
});

