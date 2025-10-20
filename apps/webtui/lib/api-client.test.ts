import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, aiClient, APIError } from './api-client';

// Mock global fetch
global.fetch = vi.fn();

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should make GET request successfully', async () => {
    const mockResponse = { data: 'test' };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await apiClient.get('/test');
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toEqual(mockResponse);
  });

  it('should make POST request with data', async () => {
    const mockResponse = { success: true };
    const postData = { name: 'test' };
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await apiClient.post('/test', postData);
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(postData),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('should throw APIError on HTTP error', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Resource not found' }),
    });

    await expect(apiClient.get('/not-found')).rejects.toThrow(APIError);
  });

  it('should handle network errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    await expect(apiClient.get('/test')).rejects.toThrow('Network error');
  });

  it('should use AI service URL for aiClient', async () => {
    const mockResponse = { plan: [] };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    await aiClient.post('/plan', { command: 'test' });
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('4001'), // AI service port
      expect.any(Object)
    );
  });

  it('should include Content-Type header for POST requests', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await apiClient.post('/test', { data: 'test' });
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });
});

