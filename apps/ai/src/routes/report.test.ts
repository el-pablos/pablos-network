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
const mockGenerateWithGemini = vi.fn();

vi.mock('../gemini', () => ({
  generateWithGemini: mockGenerateWithGemini,
}));

describe('Report Route', () => {
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
    const { reportRoute } = await import('./report');
    await reportRoute(mockApp);
  });

  it('should register POST /report endpoint', () => {
    expect(mockApp.post).toHaveBeenCalledWith('/report', expect.any(Function));
  });

  it('should generate report successfully with valid input', async () => {
    const requestBody = {
      domain: 'example.com',
      findings: [
        {
          title: 'SQL Injection',
          severity: 'critical',
          category: 'WEB',
          description: 'SQL injection vulnerability found',
        },
        {
          title: 'XSS Vulnerability',
          severity: 'high',
          category: 'WEB',
          description: 'Cross-site scripting vulnerability',
        },
      ],
      assets: [
        { fqdn: 'www.example.com', type: 'subdomain' },
        { fqdn: 'api.example.com', type: 'subdomain' },
      ],
      metadata: {
        scanDate: '2024-01-15',
        scanner: 'pablos-network',
      },
    };

    const mockReport = `# Security Assessment Report

## Executive Summary
Critical vulnerabilities detected in example.com requiring immediate attention.

## Key Findings
- 1 Critical severity finding
- 1 High severity finding

## Technical Details
### SQL Injection (Critical)
SQL injection vulnerability found in the application.

### XSS Vulnerability (High)
Cross-site scripting vulnerability detected.

## Recommendations
1. Implement input validation
2. Use parameterized queries
3. Apply output encoding

## Conclusion
Immediate remediation required for critical findings.`;

    mockGenerateWithGemini.mockResolvedValue(mockReport);
    mockRequest.body = requestBody;

    const result = await routeHandler(mockRequest, mockReply);

    expect(mockGenerateWithGemini).toHaveBeenCalledWith(
      expect.stringContaining('Domain: example.com'),
      expect.stringContaining('You are a security report generator')
    );

    expect(result).toEqual({
      report: mockReport,
      metadata: {
        domain: 'example.com',
        generatedAt: expect.any(String),
        findingsCount: 2,
      },
    });

    // Verify metadata has valid ISO date
    expect(new Date(result.metadata.generatedAt).toISOString()).toBe(result.metadata.generatedAt);
  });

  it('should generate report without assets', async () => {
    const requestBody = {
      domain: 'test.com',
      findings: [
        {
          title: 'Open Port',
          severity: 'info',
          category: 'NET',
        },
      ],
      // No assets provided
    };

    const mockReport = '# Security Report\n\nNo critical issues found.';
    mockGenerateWithGemini.mockResolvedValue(mockReport);
    mockRequest.body = requestBody;

    const result = await routeHandler(mockRequest, mockReply);

    expect(result).toEqual({
      report: mockReport,
      metadata: {
        domain: 'test.com',
        generatedAt: expect.any(String),
        findingsCount: 1,
      },
    });

    // Verify prompt includes "Assets Scanned: 0"
    const prompt = mockGenerateWithGemini.mock.calls[0][0];
    expect(prompt).toContain('Assets Scanned: 0');
  });

  it('should generate report without metadata', async () => {
    const requestBody = {
      domain: 'example.org',
      findings: [],
      // No metadata provided
    };

    const mockReport = '# Clean Report\n\nNo findings detected.';
    mockGenerateWithGemini.mockResolvedValue(mockReport);
    mockRequest.body = requestBody;

    const result = await routeHandler(mockRequest, mockReply);

    expect(result).toEqual({
      report: mockReport,
      metadata: {
        domain: 'example.org',
        generatedAt: expect.any(String),
        findingsCount: 0,
      },
    });
  });

  it('should handle invalid request body with Zod validation error', async () => {
    mockRequest.body = {
      // Missing required fields: domain, findings
      invalid: 'data',
    };

    await routeHandler(mockRequest, mockReply);

    expect(mockReply.status).toHaveBeenCalledWith(500);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: 'Failed to generate report',
    });
  });

  it('should handle Gemini API errors', async () => {
    const requestBody = {
      domain: 'test.com',
      findings: [{ title: 'Test', severity: 'low', category: 'WEB' }],
    };

    mockGenerateWithGemini.mockRejectedValue(new Error('Gemini API timeout'));
    mockRequest.body = requestBody;

    await routeHandler(mockRequest, mockReply);

    expect(mockReply.status).toHaveBeenCalledWith(500);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: 'Failed to generate report',
    });
  });

  it('should include system instruction with correct sections', async () => {
    const requestBody = {
      domain: 'test.com',
      findings: [],
    };

    mockGenerateWithGemini.mockResolvedValue('# Report');
    mockRequest.body = requestBody;

    await routeHandler(mockRequest, mockReply);

    const systemInstruction = mockGenerateWithGemini.mock.calls[0][1];
    
    expect(systemInstruction).toContain('You are a security report generator');
    expect(systemInstruction).toContain('1. Executive Summary');
    expect(systemInstruction).toContain('2. Scope & Methodology');
    expect(systemInstruction).toContain('3. Key Findings (grouped by severity)');
    expect(systemInstruction).toContain('4. Technical Details');
    expect(systemInstruction).toContain('5. Recommendations');
    expect(systemInstruction).toContain('6. Conclusion');
    expect(systemInstruction).toContain('Use professional security language');
  });

  it('should include findings summary in prompt', async () => {
    const requestBody = {
      domain: 'vulnerable.com',
      findings: [
        {
          title: 'Critical Vuln',
          severity: 'critical',
          category: 'WEB',
          description: 'Detailed description',
          metadata: { extra: 'data' },
        },
        {
          title: 'Info Finding',
          severity: 'info',
          category: 'DNS',
          description: 'DNS info',
        },
      ],
    };

    mockGenerateWithGemini.mockResolvedValue('# Report');
    mockRequest.body = requestBody;

    await routeHandler(mockRequest, mockReply);

    const prompt = mockGenerateWithGemini.mock.calls[0][0];
    
    expect(prompt).toContain('Domain: vulnerable.com');
    expect(prompt).toContain('Total Findings: 2');
    expect(prompt).toContain('Findings Summary:');
    
    // Verify summary only includes title, severity, category (not description or metadata)
    const summaryMatch = prompt.match(/Findings Summary:\n([\s\S]*?)\n\nFull Findings:/);
    expect(summaryMatch).toBeTruthy();
    
    if (summaryMatch) {
      const summary = summaryMatch[1];
      expect(summary).toContain('"title": "Critical Vuln"');
      expect(summary).toContain('"severity": "critical"');
      expect(summary).toContain('"category": "WEB"');
      expect(summary).not.toContain('Detailed description');
      expect(summary).not.toContain('extra');
    }
  });

  it('should include full findings in prompt', async () => {
    const requestBody = {
      domain: 'test.com',
      findings: [
        {
          title: 'Full Finding',
          severity: 'medium',
          category: 'NET',
          description: 'Complete description',
          metadata: { port: 443, service: 'https' },
        },
      ],
    };

    mockGenerateWithGemini.mockResolvedValue('# Report');
    mockRequest.body = requestBody;

    await routeHandler(mockRequest, mockReply);

    const prompt = mockGenerateWithGemini.mock.calls[0][0];
    
    expect(prompt).toContain('Full Findings:');
    expect(prompt).toContain('"title": "Full Finding"');
    expect(prompt).toContain('"description": "Complete description"');
    expect(prompt).toContain('"port": 443');
    expect(prompt).toContain('"service": "https"');
  });

  it('should handle empty findings array', async () => {
    const requestBody = {
      domain: 'clean.com',
      findings: [],
      assets: [],
    };

    const mockReport = '# Clean Scan Report\n\nNo vulnerabilities detected.';
    mockGenerateWithGemini.mockResolvedValue(mockReport);
    mockRequest.body = requestBody;

    const result = await routeHandler(mockRequest, mockReply);

    expect(result).toEqual({
      report: mockReport,
      metadata: {
        domain: 'clean.com',
        generatedAt: expect.any(String),
        findingsCount: 0,
      },
    });

    const prompt = mockGenerateWithGemini.mock.calls[0][0];
    expect(prompt).toContain('Total Findings: 0');
    expect(prompt).toContain('Assets Scanned: 0');
  });

  it('should handle large number of findings and assets', async () => {
    const findings = Array.from({ length: 50 }, (_, i) => ({
      title: `Finding ${i + 1}`,
      severity: i % 2 === 0 ? 'high' : 'medium',
      category: 'WEB',
      description: `Description for finding ${i + 1}`,
    }));

    const assets = Array.from({ length: 100 }, (_, i) => ({
      fqdn: `sub${i}.example.com`,
      type: 'subdomain',
    }));

    const requestBody = {
      domain: 'example.com',
      findings,
      assets,
    };

    const mockReport = '# Comprehensive Report\n\n50 findings across 100 assets.';
    mockGenerateWithGemini.mockResolvedValue(mockReport);
    mockRequest.body = requestBody;

    const result = await routeHandler(mockRequest, mockReply);

    expect(result.metadata.findingsCount).toBe(50);

    const prompt = mockGenerateWithGemini.mock.calls[0][0];
    expect(prompt).toContain('Total Findings: 50');
    expect(prompt).toContain('Assets Scanned: 100');
  });
});

