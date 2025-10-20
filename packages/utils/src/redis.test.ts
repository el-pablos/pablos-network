import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ioredis
const mockRedisInstance = {
  on: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  quit: vi.fn(),
};

vi.mock('ioredis', () => {
  return {
    default: vi.fn(() => mockRedisInstance),
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

describe('Redis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    process.env.REDIS_HOST = 'redis-test.example.com';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_USERNAME = 'default';
    process.env.REDIS_PASSWORD = 'test-password';
  });

  describe('createRedisClient', () => {
    it('should create Redis client with TLS enabled', async () => {
      // Need to re-import to get fresh instance
      vi.resetModules();
      const IORedis = (await import('ioredis')).default;
      const { createRedisClient } = await import('./redis');

      const client = createRedisClient();

      expect(client).toBeDefined();
      expect(IORedis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'redis-test.example.com',
          port: 6379,
          username: 'default',
          password: 'test-password',
          tls: {},
        })
      );
    });

    it('should reuse existing client', async () => {
      vi.resetModules();
      const { createRedisClient } = await import('./redis');

      const client1 = createRedisClient();
      const client2 = createRedisClient();

      expect(client1).toBe(client2);
    });

    it('should throw error if REDIS_HOST is missing', async () => {
      vi.resetModules();
      delete process.env.REDIS_HOST;

      await expect(async () => {
        const { createRedisClient } = await import('./redis');
        createRedisClient();
      }).rejects.toThrow('Redis configuration missing');
    });

    it('should throw error if REDIS_PORT is missing', async () => {
      vi.resetModules();
      delete process.env.REDIS_PORT;

      await expect(async () => {
        const { createRedisClient } = await import('./redis');
        createRedisClient();
      }).rejects.toThrow('Redis configuration missing');
    });

    it('should throw error if REDIS_PASSWORD is missing', async () => {
      vi.resetModules();
      delete process.env.REDIS_PASSWORD;

      await expect(async () => {
        const { createRedisClient } = await import('./redis');
        createRedisClient();
      }).rejects.toThrow('Redis configuration missing');
    });

    it('should configure retry strategy', async () => {
      vi.resetModules();
      const IORedis = (await import('ioredis')).default;
      const { createRedisClient } = await import('./redis');

      createRedisClient();

      const config = (IORedis as any).mock.calls[0][0];
      expect(config.retryStrategy).toBeDefined();

      // Test retry strategy
      const delay1 = config.retryStrategy(1);
      const delay2 = config.retryStrategy(10);
      const delay3 = config.retryStrategy(100);

      expect(delay1).toBe(50); // 1 * 50
      expect(delay2).toBe(500); // 10 * 50
      expect(delay3).toBe(2000); // Max delay
    });

    it('should set maxRetriesPerRequest', async () => {
      vi.resetModules();
      const IORedis = (await import('ioredis')).default;
      const { createRedisClient } = await import('./redis');

      createRedisClient();

      const config = (IORedis as any).mock.calls[0][0];
      expect(config.maxRetriesPerRequest).toBe(3);
    });

    it('should register event handlers', async () => {
      vi.resetModules();
      const { createRedisClient } = await import('./redis');

      createRedisClient();

      expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should handle connection events', async () => {
      vi.resetModules();
      const { createRedisClient } = await import('./redis');

      createRedisClient();

      // Get event handlers
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];
      const errorHandler = mockRedisInstance.on.mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1];
      const closeHandler = mockRedisInstance.on.mock.calls.find(
        (call) => call[0] === 'close'
      )?.[1];

      expect(connectHandler).toBeDefined();
      expect(errorHandler).toBeDefined();
      expect(closeHandler).toBeDefined();

      // Simulate events
      connectHandler?.();
      errorHandler?.(new Error('Test error'));
      closeHandler?.();
    });
  });

  describe('redis singleton', () => {
    it('should export redis instance', async () => {
      vi.resetModules();
      const { redis } = await import('./redis');

      expect(redis).toBeDefined();
    });
  });
});

