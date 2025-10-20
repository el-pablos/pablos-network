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

// Create mock Fastify instance
const mockRegister = vi.fn();
const mockGet = vi.fn();
const mockListen = vi.fn();

const mockFastifyInstance = {
  register: mockRegister,
  get: mockGet,
  listen: mockListen,
};

// Mock Fastify constructor
const mockFastify = vi.fn(() => mockFastifyInstance);

vi.mock('fastify', () => ({
  default: mockFastify,
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
  beforeAll(() => {
    // Set default listen behavior
    mockListen.mockImplementation((opts: any, callback: any) => {
      callback(null, `http://0.0.0.0:${opts.port}`);
    });
  });

  it('should initialize Fastify server with correct options', async () => {
    expect(mockFastify).toHaveBeenCalledWith({ logger: false });
  });

  it('should register all four routes', async () => {
    expect(mockRegister).toHaveBeenCalledTimes(4);
  });

  it('should register health check endpoint', async () => {
    expect(mockGet).toHaveBeenCalledWith('/health', expect.any(Function));
  });

  it('should start server on correct port and host', async () => {
    expect(mockListen).toHaveBeenCalledWith(
      { port: 4001, host: '0.0.0.0' },
      expect.any(Function)
    );
  });

  it('should return correct health status', async () => {
    const healthHandler = mockGet.mock.calls.find(
      (call) => call[0] === '/health'
    )?.[1];

    expect(healthHandler).toBeDefined();

    if (healthHandler) {
      const result = await healthHandler();
      expect(result).toEqual({ status: 'ok', service: 'ai' });
    }
  });

  it('should handle server startup errors and exit with code 1', async () => {
    // Reset modules to test error path
    vi.resetModules();

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Create new mock with error behavior
    const errorMockListen = vi.fn((opts: any, callback: any) => {
      callback(new Error('Port already in use'), null);
    });

    const errorMockFastifyInstance = {
      register: vi.fn(),
      get: vi.fn(),
      listen: errorMockListen,
    };

    const errorMockFastify = vi.fn(() => errorMockFastifyInstance);

    vi.doMock('fastify', () => ({
      default: errorMockFastify,
    }));

    // Re-import to trigger error path
    await import('./index');

    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});

