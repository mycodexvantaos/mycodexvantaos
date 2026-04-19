const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    // SSRF guard: reject absolute URLs and protocol-relative URLs
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new Error('apiFetch: path must be a relative path starting with "/" (got: ' + path.slice(0, 32) + ')');
    }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined)
  };

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  const response = await fetch(BASE_URL + path, {
    ...init,
    headers
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = (body as Record<string, string>).error || response.statusText;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
