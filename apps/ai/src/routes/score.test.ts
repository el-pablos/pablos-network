import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { scoreRoute } from './score';

// Mock Gemini
vi.mock('../gemini', () => ({
  generateJSONWithGemini: vi.fn().mockResolvedValue({
    cvss: 7.5,
    severity: 'high',
    explanation: 'This vulnerability allows unauthorized access to sensitive data',
    recommendations: ['Patch immediately', 'Monitor for exploitation', 'Implement WAF rules'],
  }),
}));

// Mock logger
vi.mock('@pablos/utils', async () => {
  const actual = await vi.importActual('@pablos/utils');
  return {
    ...actual,
    createLogger: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  };
});

describe('Score Route', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await scoreRoute(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should calculate CVSS score for finding', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/score',
      payload: {
        finding: {
          title: 'SQL Injection in login form',
          description: 'Unvalidated user input allows SQL injection',
          category: 'WEB',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data).toHaveProperty('cvss');
    expect(data).toHaveProperty('severity');
    expect(data).toHaveProperty('explanation');
    expect(data).toHaveProperty('recommendations');
  });

  it('should validate CVSS score range (0-10)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/score',
      payload: {
        finding: {
          title: 'Test vulnerability',
          category: 'WEB',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.cvss).toBeGreaterThanOrEqual(0);
    expect(data.cvss).toBeLessThanOrEqual(10);
  });

  it('should validate severity levels', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/score',
      payload: {
        finding: {
          title: 'Test vulnerability',
          category: 'WEB',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    const validSeverities = ['info', 'low', 'medium', 'high', 'critical'];
    expect(validSeverities).toContain(data.severity);
  });

  it('should include context in scoring', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/score',
      payload: {
        finding: {
          title: 'Exposed admin panel',
          category: 'WEB',
        },
        context: {
          assetType: 'production',
          exposure: 'public',
          businessCriticality: 'high',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.cvss).toBeDefined();
  });

  it('should provide recommendations', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/score',
      payload: {
        finding: {
          title: 'Outdated software version',
          category: 'POLICY',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(Array.isArray(data.recommendations)).toBe(true);
    expect(data.recommendations.length).toBeGreaterThan(0);
  });

  it('should validate request schema', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/score',
      payload: {
        // Missing required finding field
      },
    });

    expect(response.statusCode).toBe(400);
  });
});

