import { getAuthToken } from '../context/AuthContext';

// Get and validate API base URL
const getApiBaseUrl = () => {
  const url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
  
  // Remove trailing slash if present
  const cleanUrl = url.replace(/\/$/, '');
  
  // Validate it's an absolute URL
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    console.error(
      `[apiFetch] Invalid VITE_API_BASE_URL: "${url}". ` +
      `It must be a full URL starting with http:// or https://. ` +
      `Current value will cause requests to fail.`
    );
  }
  
  return cleanUrl;
};

const API_BASE_URL = getApiBaseUrl();

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAuthToken?.() ?? null;

  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${API_BASE_URL}${cleanPath}`;

  if (import.meta.env.DEV) {
    console.log('[apiFetch] Requesting:', fullUrl);
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error('[apiFetch] Error response:', response.status, text);

    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}
