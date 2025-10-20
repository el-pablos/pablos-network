import { createLogger } from './logger';

const logger = createLogger('http');

export interface HttpClientOptions {
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
}

export class HttpClient {
  private baseURL?: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private retries: number;

  constructor(baseURL?: string, options: HttpClientOptions = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = options.headers || {};
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempt: number = 1
  ): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (attempt < this.retries) {
        logger.warn({ url, attempt, error }, 'HTTP request failed, retrying...');
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }

  async get<T = any>(path: string, headers?: Record<string, string>): Promise<T> {
    const url = this.baseURL ? `${this.baseURL}${path}` : path;
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: { ...this.defaultHeaders, ...headers },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async post<T = any>(
    path: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    const url = this.baseURL ? `${this.baseURL}${path}` : path;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.defaultHeaders,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }
}

