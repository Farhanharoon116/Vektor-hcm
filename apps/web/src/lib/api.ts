const API_BASE = '/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

// In-memory SWR (Stale-While-Revalidate) cache for instant tab transitions
interface CacheEntry {
  data: any;
  timestamp: number;
}
const requestCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 25000; // 25 seconds fast cache

export function clearApiCache() {
  requestCache.clear();
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit & { skipCache?: boolean } = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const token = localStorage.getItem('vektor_auth_token');

  // Invalidate cache on mutations (POST, PATCH, DELETE)
  if (method !== 'GET') {
    requestCache.clear();
  } else if (!options.skipCache) {
    // Check in-memory cache for GET
    const cacheKey = `${endpoint}_${token || ''}`;
    const cached = requestCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data as T;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('vektor_auth_token');
    localStorage.removeItem('vektor_user');
    requestCache.clear();
  }

  const contentType = response.headers.get('content-type');
  let data: any = null;

  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else if (
    contentType &&
    (contentType.includes('text/csv') ||
      contentType.includes('application/pdf') ||
      contentType.includes('octet-stream'))
  ) {
    data = await response.blob();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error || response.statusText || 'Request failed';
    throw new ApiError(response.status, errorMsg, data);
  }

  // Save to fast cache for GET requests
  if (method === 'GET' && !options.skipCache) {
    const cacheKey = `${endpoint}_${token || ''}`;
    requestCache.set(cacheKey, { data, timestamp: Date.now() });
  }

  return data;
}

export const api = {
  get: <T = any>(endpoint: string, options?: RequestInit & { skipCache?: boolean }) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),

  clearCache: clearApiCache,
};
