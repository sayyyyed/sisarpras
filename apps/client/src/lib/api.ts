const RAW_BASE = import.meta.env.VITE_API_URL as string | undefined;

/** Base URL of apps/api. Override with VITE_API_URL. */
export const API_BASE = (RAW_BASE ?? "http://localhost:8787").replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /** status 0 = the request never reached the server (offline / server down). */
  get isOffline(): boolean {
    return this.status === 0;
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit, options: { skipAuth?: boolean } = {}): Promise<T> {
  let response: Response;

  try {
    const headers = new Headers(init?.headers);
    if (!options.skipAuth && !headers.has("authorization")) {
      const token = localStorage.getItem("sisarpras.api-token.v1");
      if (token) headers.set("authorization", `Bearer ${token}`);
    }
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...Object.fromEntries(headers.entries()) },
    });
  } catch (error) {
    throw new ApiError(0, "Tidak dapat menghubungi server", error);
  }

  const body = await parseBody(response);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${response.status}`;
    throw new ApiError(response.status, message, body);
  }

  return body as T;
}

export { API_BASE as apiBase };
