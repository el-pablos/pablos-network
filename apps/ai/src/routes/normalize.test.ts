import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Mock environment variables
process.env.GEMINI_API_KEY = 'test-api-key';

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
const mockGenerateJSONWithGemini = vi.fn();

vi.mock('../gemini', () => ({
  generateJSONWithGemini: mockGenerateJSONWithGemini,
}));

describe('Normalize Route', () => {
  let mockApp: FastifyInstance;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let routeHandler: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock Fastify app
    mockApp = {
      post: vi.fn((path: string, handler: any) => {
        routeHandler = handler;
      }),
    } as any;

    // Mock request
    mockRequest = {
      body: {},
    };

    // Mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Import and register route
    const { normalizeRoute } = await import('./normalize');
    await normalizeRoute(mockApp);
  });

  it('should register POST /normalize endpoint', () => {
    expect(mockApp.post).toHaveBeenCalledWith('/normalize', expect.any(Function));
  });

  it('should normalize findings successfully with valid input', async () => {
    const requestBody = {
      provider: 'dirsearch',
      rawData: {
        paths: ['/admin', '/login', '/api'],
        status: 200,
      },
      targetRef: '507f1f77bcf86cd799439011', // Valid MongoDB ObjectId
      targetFqdn: 'www.example.com',
    };

    const mockFindings = [
      {
        title: 'Admin Panel Exposed',
        description: 'Admin panel is publicly accessible',
        severity: 'high',
        category: 'WEB',
        fingerprint: 'admin-panel-exposed',
        metadata: { path: '/admin' },
      },
      {
        title: 'Login Page Found',
        description: 'Login page discovered',
        severity: 'info',
        category: 'WEB',
        fingerprint: 'login-page-found',
        metadata: { path: '/login' },
      },
    ];

    mockGenerateJSONWithGemini.mockResolvedValue(mockFindings);
    mockRequest.body = requestBody;

    const result = await routeHandler(mockRequest, mockReply);

    expect(mockGenerateJSONWithGemini).toHaveBeenCalledWith(
      expect.stringContaining('Provider: dirsearch'),
      expect.stringContaining('You are a security finding normalizer')
    );

    expect(result).toEqual({
      findings: expect.arrayContaining([
        expect.objectContaining({
          title: 'Admin Panel Exposed',
          severity: 'high',
          category: 'WEB',
          targetRef: '507f1f77bcf86cd799439011',
          targetFqdn: 'www.example.com',
          provider: 'dirsearch',
        }),
        expect.objectContaining({
          title: 'Login Page Found',
          severity: 'info',
          category: 'WEB',
          targetRef: '507f1f77bcf86cd799439011',
          targetFqdn: 'www.example.com',
          provider: 'dirsearch',
        }),
      ]),
    });
  });

  it('should normalize findings without targetFqdn', async () => {
    const requestBody = {
      provider: 'reverseip', // Valid provider enum
      rawData: { origins: ['1.1.1.1', '8.8.8.8'] },
      targetRef: '507f1f77bcf86cd799439011', // Valid MongoDB ObjectId
    };

    const mockFindings = [
      {
        title: 'Cloudflare Origin IP Detected',
        description: 'Origin server IP: 1.1.1.1',
        severity: 'medium',
        category: 'NET',
        fingerprint: 'origin-ip-1.1.1.1',
        metadata: { ip: '1.1.1.1' },
      },
    ];

    mockGenerateJSONWithGemini.mockResolvedValue(mockFindings);
    mockRequest.body = requestBody;

    const result = await routeHandler(mockRequest, mockReply);

    expect(result).toEqual({
      findings: expect.arrayContaining([
        expect.objectContaining({
          title: 'Cloudflare Origin IP Detected',
          targetRef: '507f1f77bcf86cd799439011',
          provider: 'reverseip',
        }),
      ]),
    });
  });

  it('should handle invalid request body with Zod validation error', async () => {
    mockRequest.body = {
      // Missing required fields: provider, rawData, targetRef
      invalid: 'data',
    };

    await routeHandler(mockRequest, mockReply);

    expect(mockReply.status).toHaveBeenCalledWith(500);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: 'Failed to normalize findings',
    });
  });

  it('should handle Gemini API errors', async () => {
    const requestBody = {
      provider: 'test-provider',
      rawData: { test: 'data' },
      targetRef: 'test.com',
    };

    mockGenerateJSONWithGemini.mockRejectedValue(new Error('Gemini API rate limit exceeded'));
    mockRequest.body = requestBody;

    await routeHandler(mockRequest, mockReply);

    expect(mockReply.status).toHaveBeenCalledWith(500);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: 'Failed to normalize findings',
    });
  });

  it('should handle invalid finding schema from Gemini response', async () => {
    const requestBody = {
      provider: 'test-provider',
      rawData: { test: 'data' },
      targetRef: 'test.com',
    };

    // Gemini returns findings with invalid severity
    const invalidFindings = [
      {
        title: 'Test Finding',
        description: 'Test description',
        severity: 'invalid-severity', // Invalid enum value
        category: 'WEB',
        fingerprint: 'test-fingerprint',
      },
    ];

    mockGenerateJSONWithGemini.mockResolvedValue(invalidFindings);
    mockRequest.body = requestBody;

    await routeHandler(mockRequest, mockReply);

    expect(mockReply.status).toHaveBeenCalledWith(500);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: 'Failed to normalize findings',
    });
  });

  it('should include system instruction with correct format', async () => {
    const requestBody = {
      provider: 'test-provider',
      rawData: { test: 'data' },
      targetRef: 'test.com',
    };

    mockGenerateJSONWithGemini.mockResolvedValue([]);
    mockRequest.body = requestBody;

    await routeHandler(mockRequest, mockReply);

    const systemInstruction = mockGenerateJSONWithGemini.mock.calls[0][1];
    
    expect(systemInstruction).toContain('You are a security finding normalizer');
    expect(systemInstruction).toContain('severity: info, low, medium, high, or critical');
    expect(systemInstruction).toContain('category: DNS, WEB, NET, OSINT, POLICY, SEO, or MEDIA');
  });

  it('should include provider and target in prompt', async () => {
    const requestBody = {
      provider: 'custom-scanner',
      rawData: { vulnerabilities: ['XSS', 'SQLi'] },
      targetRef: 'vulnerable.com',
      targetFqdn: 'www.vulnerable.com',
    };

    mockGenerateJSONWithGemini.mockResolvedValue([]);
    mockRequest.body = requestBody;

    await routeHandler(mockRequest, mockReply);

    const prompt = mockGenerateJSONWithGemini.mock.calls[0][0];
    
    expect(prompt).toContain('Provider: custom-scanner');
    expect(prompt).toContain('Target: www.vulnerable.com');
    expect(prompt).toContain(JSON.stringify(requestBody.rawData, null, 2));
  });

  it('should use targetRef when targetFqdn is not provided in prompt', async () => {
    const requestBody = {
      provider: 'test-provider',
      rawData: { test: 'data' },
      targetRef: 'example.com',
      // No targetFqdn
    };

    mockGenerateJSONWithGemini.mockResolvedValue([]);
    mockRequest.body = requestBody;

    await routeHandler(mockRequest, mockReply);

    const prompt = mockGenerateJSONWithGemini.mock.calls[0][0];
    
    expect(prompt).toContain('Target: example.com');
  });

  it('should return empty findings array when Gemini returns empty array', async () => {
    const requestBody = {
      provider: 'test-provider',
      rawData: { noFindings: true },
      targetRef: '507f1f77bcf86cd799439011', // Valid MongoDB ObjectId
    };

    mockGenerateJSONWithGemini.mockResolvedValue([]);
    mockRequest.body = requestBody;

    const result = await routeHandler(mockRequest, mockReply);

    expect(result).toEqual({ findings: [] });
  });

  it('should validate all finding fields with CreateFindingSchema', async () => {
    const requestBody = {
      provider: 'zap', // Valid provider enum
      rawData: { scan: 'complete' },
      targetRef: '507f1f77bcf86cd799439011', // Valid MongoDB ObjectId
      targetFqdn: 'www.test.com',
    };

    const mockFindings = [
      {
        title: 'Complete Finding',
        description: 'Full description',
        severity: 'critical',
        category: 'WEB',
        fingerprint: 'complete-finding-hash',
        metadata: {
          cve: 'CVE-2024-1234',
          cvss: 9.8,
          references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-1234'],
        },
      },
    ];

    mockGenerateJSONWithGemini.mockResolvedValue(mockFindings);
    mockRequest.body = requestBody;

    const result = await routeHandler(mockRequest, mockReply);

    expect(result.findings[0]).toMatchObject({
      title: 'Complete Finding',
      description: 'Full description',
      severity: 'critical',
      category: 'WEB',
      fingerprint: 'complete-finding-hash',
      targetRef: '507f1f77bcf86cd799439011',
      targetFqdn: 'www.test.com',
      provider: 'zap',
      metadata: expect.objectContaining({
        cve: 'CVE-2024-1234',
        cvss: 9.8,
      }),
    });
  });
});

