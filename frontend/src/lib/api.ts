// Calls to our backend (/api/... -> FastAPI). Adds the login token to every request.

import { getAccessToken } from "./auth";

// An error the backend sent back: {"error": {"code": ..., "message": ...}}
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = await getAccessToken();
  if (token) headers["Authorization"] = "Bearer " + token;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch("/api" + path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  // Not a 2xx: use the backend's error message if there is one.
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code ?? "http_error";
    const message = body?.error?.message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, code, message);
  }

  // 204 No Content has no body.
  if (res.status === 204) return undefined as T;
  return res.json();
}
