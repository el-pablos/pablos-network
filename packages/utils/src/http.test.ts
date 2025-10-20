import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpClient } from './http';

// Mock global fetch
global.fetch = vi.fn();

describe('HttpClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with base URL', () => {
      const client = new HttpClient('http://localhost:4000');
      expect(client).toBeInstanceOf(HttpClient);
    });

    it('should create client with default headers', () => {
      const client = new HttpClient('http://localhost:4000', {
        headers: {
          'X-Custom-Header': 'value',
        },
      });
      expect(client).toBeInstanceOf(HttpClient);
    });
  });

  describe('get', () => {
    it('should make GET request successfully', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const client = new HttpClient('http://localhost:4000');
      const result = await client.get('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/test',
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on HTTP error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const client = new HttpClient('http://localhost:4000');
      
      await expect(client.get('/not-found')).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should retry on failure', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success' }),
        });

      const client = new HttpClient('http://localhost:4000');
      const result = await client.get('/test');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: 'success' });
    });

    it('should fail after max retries', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const client = new HttpClient('http://localhost:4000');
      
      await expect(client.get('/test')).rejects.toThrow('Network error');
      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('post', () => {
    it('should make POST request with data', async () => {
      const mockResponse = { success: true };
      const postData = { name: 'test' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const client = new HttpClient('http://localhost:4000');
      const result = await client.post('/test', postData);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should make POST request without body', async () => {
      const mockResponse = { success: true };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const client = new HttpClient('http://localhost:4000');
      const result = await client.post('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/test',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should include custom headers', async () => {
      const mockResponse = { success: true };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const client = new HttpClient('http://localhost:4000');
      await client.post('/test', {}, { 'X-Custom': 'value' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom': 'value',
          }),
        })
      );
    });

    it('should throw error on HTTP error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const client = new HttpClient('http://localhost:4000');
      
      await expect(client.post('/test', {})).rejects.toThrow('HTTP 400: Bad Request');
    });
  });

  describe('without base URL', () => {
    it('should make request with full URL', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const client = new HttpClient();
      const result = await client.get('http://example.com/test');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://example.com/test',
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should make POST request with full URL', async () => {
      const mockResponse = { success: true };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const client = new HttpClient();
      const result = await client.post('http://example.com/test', { data: 'test' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://example.com/test',
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('timeout handling', () => {
    it('should handle timeout with AbortController', async () => {
      const client = new HttpClient('http://localhost:4000', { timeout: 100 });

      (global.fetch as any).mockImplementation(() =>
        new Promise((resolve, reject) => {
          // Simulate a long-running request that gets aborted
          setTimeout(() => {
            const error: any = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          }, 50);
        })
      );

      await expect(client.get('/test')).rejects.toThrow();
    });
  });

  describe('custom options', () => {
    it('should use custom timeout', () => {
      const client = new HttpClient('http://localhost:4000', { timeout: 5000 });
      expect(client).toBeInstanceOf(HttpClient);
    });

    it('should use custom retries', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const client = new HttpClient('http://localhost:4000', { retries: 1 });

      await expect(client.get('/test')).rejects.toThrow('Network error');
      expect(global.fetch).toHaveBeenCalledTimes(1); // No retries
    });

    it('should merge default and custom headers in GET', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const client = new HttpClient('http://localhost:4000', {
        headers: { 'X-Default': 'default' },
      });

      await client.get('/test', { 'X-Custom': 'custom' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Default': 'default',
            'X-Custom': 'custom',
          }),
        })
      );
    });

    it('should merge default and custom headers in POST', async () => {
      const mockResponse = { success: true };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const client = new HttpClient('http://localhost:4000', {
        headers: { 'X-Default': 'default' },
      });

      await client.post('/test', {}, { 'X-Custom': 'custom' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Default': 'default',
            'X-Custom': 'custom',
          }),
        })
      );
    });
  });

  describe('retry logic', () => {
    it('should wait between retries with exponential backoff', async () => {
      vi.useFakeTimers();

      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success' }),
        });

      const client = new HttpClient('http://localhost:4000');
      const promise = client.get('/test');

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);

      // Wait for first retry (1000ms)
      await vi.advanceTimersByTimeAsync(1000);

      // Wait for second retry (2000ms)
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toEqual({ data: 'success' });
      expect(global.fetch).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });
  });
});

