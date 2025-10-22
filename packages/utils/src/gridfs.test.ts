import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable, Writable } from 'stream';
import { ObjectId } from 'mongodb';
import { EventEmitter } from 'events';

// Mock MongoDB
class MockUploadStream extends EventEmitter {
  id = new ObjectId('507f1f77bcf86cd799439011');
  write = vi.fn();
  end = vi.fn();
}

const mockUploadStream = new MockUploadStream();

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
    // Reset upload stream
    mockUploadStream.removeAllListeners();
    mockUploadStream.on('finish', () => {
      // Auto-emit finish for successful uploads
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

    it('should throw error when MONGODB_URI is not configured', async () => {
      // Clear module cache to test initialization without client
      vi.resetModules();

      // Remove MONGODB_URI from env
      const originalUri = process.env.MONGODB_URI;
      delete process.env.MONGODB_URI;

      const { initGridFS } = await import('./gridfs');

      await expect(initGridFS()).rejects.toThrow('MONGODB_URI not configured');

      // Restore env
      if (originalUri) {
        process.env.MONGODB_URI = originalUri;
      }
    });
  });

  describe('saveEvidence', () => {
    it('should save evidence from Buffer', async () => {
      const { saveEvidence } = await import('./gridfs');
      const buffer = Buffer.from('test data');
      const metadata = {
        filename: 'test.txt',
        contentType: 'text/plain',
        size: buffer.length,
      };

      // Emit finish event after a short delay
      setTimeout(() => mockUploadStream.emit('finish'), 10);

      const fileId = await saveEvidence(buffer, metadata);

      expect(fileId).toBeDefined();
      expect(mockBucket.openUploadStream).toHaveBeenCalledWith('test.txt', expect.any(Object));
    });

    it('should save evidence from string', async () => {
      const { saveEvidence } = await import('./gridfs');
      const data = 'test data string';
      const metadata = {
        filename: 'test.txt',
        contentType: 'text/plain',
        size: data.length,
      };

      // Emit finish event after a short delay
      setTimeout(() => mockUploadStream.emit('finish'), 10);

      const fileId = await saveEvidence(data, metadata);

      expect(fileId).toBeDefined();
      expect(mockBucket.openUploadStream).toHaveBeenCalledWith('test.txt', expect.any(Object));
    });

    it('should save evidence from Readable stream', async () => {
      const { saveEvidence } = await import('./gridfs');
      const stream = new Readable({
        read() {
          this.push('test data');
          this.push(null);
        },
      });
      const metadata = {
        filename: 'test.txt',
        contentType: 'text/plain',
        size: 9,
      };

      // Emit finish event after a short delay
      setTimeout(() => mockUploadStream.emit('finish'), 10);

      const fileId = await saveEvidence(stream, metadata);

      expect(fileId).toBeDefined();
      expect(mockBucket.openUploadStream).toHaveBeenCalledWith('test.txt', expect.any(Object));
    });

    it('should handle upload errors', async () => {
      const { saveEvidence } = await import('./gridfs');
      const buffer = Buffer.from('test data');
      const metadata = {
        filename: 'test.txt',
        contentType: 'text/plain',
        size: buffer.length,
      };

      // Emit error event after a short delay
      setTimeout(() => mockUploadStream.emit('error', new Error('Upload failed')), 10);

      await expect(saveEvidence(buffer, metadata)).rejects.toThrow('Upload failed');
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

    it('should retrieve evidence metadata with string fileId', async () => {
      const { getEvidenceMetadata } = await import('./gridfs');
      const fileIdString = '507f1f77bcf86cd799439011';

      const metadata = await getEvidenceMetadata(fileIdString);

      expect(metadata).toBeDefined();
      expect(metadata.filename).toBe('test.txt');
      expect(mockBucket.find).toHaveBeenCalledWith({ _id: expect.any(ObjectId) });
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

