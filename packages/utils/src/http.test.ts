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
  });
});

