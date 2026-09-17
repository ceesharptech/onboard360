const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const accessToken = localStorage.getItem('access_token');
  if (accessToken && !options.skipAuth) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 token refresh
  if (response.status === 401 && !options.skipAuth && !path.includes('/auth/login')) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.dispatchEvent(new Event('auth:logout'));
      throw new Error('Authentication required');
    }

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!refreshResponse.ok) {
          throw new Error('Failed to refresh token');
        }

        const data = await refreshResponse.json();
        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;

        localStorage.setItem('access_token', newAccessToken);
        localStorage.setItem('refresh_token', newRefreshToken);
        isRefreshing = false;
        onRefreshed(newAccessToken);
      } catch {
        isRefreshing = false;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.dispatchEvent(new Event('auth:logout'));
        throw new Error('Session expired. Please log in again.');
      }
    }

    // Wait for the new token and retry request
    return new Promise((resolve, reject) => {
      subscribeTokenRefresh(async (newToken: string) => {
        try {
          headers.set('Authorization', `Bearer ${newToken}`);
          const retryResponse = await fetch(url, {
            ...options,
            headers,
          });
          const retryData = await retryResponse.json();
          if (!retryResponse.ok) {
            return reject(new Error(retryData.error?.message || 'Request failed'));
          }
          const retryResult = retryData.data !== undefined ? retryData.data : retryData;
          if (retryData.pagination && Array.isArray(retryResult)) {
            (retryResult as any).pagination = retryData.pagination;
          }
          resolve(retryResult as T);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = responseData.error?.message || responseData.message || 'Request failed';
    throw new Error(message);
  }

  const result = responseData.data !== undefined ? responseData.data : responseData;
  if (responseData.pagination && Array.isArray(result)) {
    (result as any).pagination = responseData.pagination;
  }

  return result as T;
}
