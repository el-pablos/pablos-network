import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { planRoute } from './plan';

// Mock Gemini
vi.mock('../gemini', () => ({
  generateJSONWithGemini: vi.fn().mockResolvedValue({
    steps: [
      {
        id: 'step-1',
        provider: 'dns',
        dependsOn: [],
        params: {},
        estimatedDuration: 60,
        priority: 1,
      },
      {
        id: 'step-2',
        provider: 'zoomEye',
        dependsOn: ['step-1'],
        params: {},
        estimatedDuration: 120,
        priority: 2,
      },
    ],
    totalEstimatedDuration: 180,
    constraints: {
      mode: 'safe',
      requiresVerification: false,
    },
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

describe('Plan Route', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await planRoute(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should generate scan plan for domain', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/plan',
      payload: {
        command: ':scan full',
        target: 'example.com',
        mode: 'safe',
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data).toHaveProperty('steps');
    expect(Array.isArray(data.steps)).toBe(true);
    expect(data.steps.length).toBeGreaterThan(0);
  });

  it('should validate request schema', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/plan',
      payload: {
        // Missing required fields
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should include mode in constraints', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/plan',
      payload: {
        command: ':scan passive',
        target: 'example.com',
        mode: 'normal',
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.constraints).toHaveProperty('mode');
  });

  it('should handle different scan modes', async () => {
    const modes = ['safe', 'normal', 'aggressive'];

    for (const mode of modes) {
      const response = await app.inject({
        method: 'POST',
        url: '/plan',
        payload: {
          command: ':scan full',
          target: 'example.com',
          mode,
        },
      });

      expect(response.statusCode).toBe(200);
    }
  });

  it('should validate plan schema output', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/plan',
      payload: {
        command: ':scan full',
        target: 'example.com',
        mode: 'safe',
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);

    // Validate schema structure
    expect(data).toHaveProperty('steps');
    expect(data).toHaveProperty('totalEstimatedDuration');
    expect(data).toHaveProperty('constraints');

    // Validate steps structure
    data.steps.forEach((step: any) => {
      expect(step).toHaveProperty('id');
      expect(step).toHaveProperty('provider');
      expect(step).toHaveProperty('dependsOn');
      expect(step).toHaveProperty('estimatedDuration');
      expect(step).toHaveProperty('priority');
    });
  });

  it('should handle Gemini API errors', async () => {
    const { generateJSONWithGemini } = await import('../gemini');
    vi.mocked(generateJSONWithGemini).mockRejectedValueOnce(new Error('API Error'));

    const response = await app.inject({
      method: 'POST',
      url: '/plan',
      payload: {
        command: ':scan full',
        target: 'example.com',
        mode: 'safe',
      },
    });

    expect(response.statusCode).toBe(500);
    const data = JSON.parse(response.body);
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Failed to generate plan');
  });

  it('should handle include and exclude arrays', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/plan',
      payload: {
        command: ':scan full',
        target: 'example.com',
        mode: 'safe',
        include: ['dns', 'zoomEye'],
        exclude: ['zap'],
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data).toHaveProperty('steps');
  });

  it('should handle missing include and exclude arrays', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/plan',
      payload: {
        command: ':scan full',
        target: 'example.com',
        mode: 'safe',
        // No include or exclude
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data).toHaveProperty('steps');
  });
});

