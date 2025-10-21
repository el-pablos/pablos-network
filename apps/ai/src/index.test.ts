import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock environment variables before importing
process.env.GEMINI_API_KEY = 'test-api-key';
process.env.AI_SERVICE_PORT = '4001';

// Mock logger
vi.mock('@pablos/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock Gemini
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => 'Mocked response',
        },
      }),
    }),
  })),
}));

// Mock Fastify - use factory function to avoid hoisting issues
vi.mock('fastify', () => ({
  default: vi.fn(() => ({
    register: vi.fn(),
    get: vi.fn(),
    listen: vi.fn((opts: any, callback: any) => {
      callback(null, `http://0.0.0.0:${opts.port}`);
    }),
  })),
}));

// Mock route modules to prevent actual imports
vi.mock('./routes/plan', () => ({
  planRoute: vi.fn(),
}));

vi.mock('./routes/normalize', () => ({
  normalizeRoute: vi.fn(),
}));

vi.mock('./routes/score', () => ({
  scoreRoute: vi.fn(),
}));

vi.mock('./routes/report', () => ({
  reportRoute: vi.fn(),
}));

describe('AI Service Index', () => {
  let mockFastify: any;
  let mockFastifyInstance: any;

  beforeAll(async () => {
    // Import the module to trigger initialization
    await import('./index');

    // Get reference to the mocked Fastify constructor
    const FastifyModule = await import('fastify');
    mockFastify = vi.mocked(FastifyModule.default);

    // Get the instance that was created
    mockFastifyInstance = mockFastify.mock.results[0]?.value;
  });

  it('should initialize Fastify server with correct options', () => {
    expect(mockFastify).toHaveBeenCalledWith({ logger: false });
  });

  it('should register all four routes', () => {
    expect(mockFastifyInstance.register).toHaveBeenCalledTimes(4);
  });

  it('should register health check endpoint', () => {
    expect(mockFastifyInstance.get).toHaveBeenCalledWith('/health', expect.any(Function));
  });

  it('should start server on correct port and host', () => {
    expect(mockFastifyInstance.listen).toHaveBeenCalledWith(
      { port: 4001, host: '0.0.0.0' },
      expect.any(Function)
    );
  });

  it('should return correct health status', async () => {
    const healthHandler = mockFastifyInstance.get.mock.calls.find(
      (call: any) => call[0] === '/health'
    )?.[1];

    expect(healthHandler).toBeDefined();

    if (healthHandler) {
      const result = await healthHandler();
      expect(result).toEqual({ status: 'ok', service: 'ai' });
    }
  });

  it('should handle server startup errors and exit with code 1', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Mock Fastify with error behavior
    vi.doMock('fastify', () => ({
      default: vi.fn(() => ({
        register: vi.fn(),
        get: vi.fn(),
        listen: vi.fn((opts: any, callback: any) => {
          callback(new Error('Port already in use'), null);
        }),
      })),
    }));

    // Reset and re-import to trigger error path
    vi.resetModules();
    await import('./index');

    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});

