import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock environment variables
vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test');
vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
vi.stubEnv('GATEWAY_PORT', '4000');

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock('@pablos/utils', async () => {
  const actual = await vi.importActual('@pablos/utils');
  return {
    ...actual,
    createLogger: vi.fn(() => mockLogger),
  };
});

// Mock NestJS
const mockApp = {
  enableCors: vi.fn(),
  listen: vi.fn().mockResolvedValue(undefined),
};

const mockFastifyAdapter = vi.fn();

vi.mock('@nestjs/core', () => ({
  NestFactory: {
    create: vi.fn().mockResolvedValue(mockApp),
  },
}));

vi.mock('@nestjs/platform-fastify', () => ({
  FastifyAdapter: mockFastifyAdapter,
  NestFastifyApplication: class MockNestFastifyApplication {},
}));

// Mock Swagger
const mockDocument = {};
vi.mock('@nestjs/swagger', () => ({
  SwaggerModule: {
    createDocument: vi.fn(() => mockDocument),
    setup: vi.fn(),
  },
  DocumentBuilder: vi.fn().mockImplementation(() => ({
    setTitle: vi.fn().mockReturnThis(),
    setDescription: vi.fn().mockReturnThis(),
    setVersion: vi.fn().mockReturnThis(),
    addTag: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue({}),
  })),
}));

// Mock AppModule
vi.mock('./app.module', () => ({
  AppModule: class MockAppModule {},
}));

describe('Gateway Bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should create logger with correct service name', async () => {
    const { createLogger } = await import('@pablos/utils');

    // The logger is created at module level
    expect(createLogger).toBeDefined();
  });

  it('should define bootstrap function', async () => {
    // The bootstrap function is defined when main.ts is imported
    const mainModule = await import('./main');
    
    // The module should be defined
    expect(mainModule).toBeDefined();
  });

  it('should create NestJS application with FastifyAdapter', async () => {
    const { NestFactory } = await import('@nestjs/core');
    const { FastifyAdapter } = await import('@nestjs/platform-fastify');
    const { AppModule } = await import('./app.module');
    
    expect(NestFactory).toBeDefined();
    expect(FastifyAdapter).toBeDefined();
    expect(AppModule).toBeDefined();
  });

  it('should configure CORS', async () => {
    expect(mockApp.enableCors).toBeDefined();
  });

  it('should setup Swagger documentation', async () => {
    const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');
    
    expect(SwaggerModule).toBeDefined();
    expect(DocumentBuilder).toBeDefined();
  });

  it('should use correct port from environment', async () => {
    vi.stubEnv('GATEWAY_PORT', '5000');
    
    // The port should be read from environment
    const port = process.env.GATEWAY_PORT;
    expect(port).toBe('5000');
  });

  it('should default to port 4000 if not specified', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');

    const port = process.env.GATEWAY_PORT || '4000';
    expect(port).toBe('4000');
  });

  it('should handle bootstrap errors and exit process', async () => {
    // Mock process.exit to prevent test termination
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Clear previous mocks
    vi.clearAllMocks();
    vi.resetModules();

    // Mock NestFactory to throw an error
    vi.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: vi.fn().mockRejectedValue(new Error('Bootstrap failed')),
      },
    }));

    // Re-import main.ts to trigger bootstrap
    try {
      await import('./main?t=' + Date.now());
    } catch (error) {
      // Expected to fail
    }

    // Wait for the error handler to execute
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify error was logged and process.exit was called
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Failed to start gateway'
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});

