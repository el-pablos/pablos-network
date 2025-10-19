const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:4001';

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function request<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new APIError(
      error.message || `HTTP ${response.status}`,
      response.status,
      error
    );
  }

  return response.json();
}

export const apiClient = {
  get: <T = any>(path: string) => request<T>(`${GATEWAY_URL}${path}`),
  
  post: <T = any>(path: string, data?: any) =>
    request<T>(`${GATEWAY_URL}${path}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  put: <T = any>(path: string, data?: any) =>
    request<T>(`${GATEWAY_URL}${path}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: <T = any>(path: string) =>
    request<T>(`${GATEWAY_URL}${path}`, {
      method: 'DELETE',
    }),
};

export const aiClient = {
  get: <T = any>(path: string) => request<T>(`${AI_URL}${path}`),
  
  post: <T = any>(path: string, data?: any) =>
    request<T>(`${AI_URL}${path}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export { GATEWAY_URL, AI_URL };

