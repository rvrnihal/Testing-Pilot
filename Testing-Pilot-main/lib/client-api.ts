"use client";

const TOKEN_KEY = "qa-copilot-token";
export const AUTH_CHANGE_EVENT = "qa-copilot-auth-change";

function normalizeLocalApiUrl(value: string) {
  return value
    .replace("://localhost", "://127.0.0.1")
    .replace("://127.0.0.1", "://127.0.0.1");
}

export function apiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const isLoopbackHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  if (configured) {
    const normalized = configured.replace(/\/+$/, "");
    return isLoopbackHost ? normalizeLocalApiUrl(normalized) : normalized;
  }

  if (isLoopbackHost) {
    return "http://127.0.0.1:4000/api";
  }

  return "http://localhost:4000/api";
}

export function getToken() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export async function apiRequest<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const token = getToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : `Unable to reach the API at ${apiBaseUrl()}.`;
    throw new Error(`${message} Check that the backend is running and the API URL is correct.`);
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error((payload as { error?: string })?.error || "Request failed.");
  }

  return payload as T;
}

export async function apiDownload(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const token = getToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : `Unable to reach the API at ${apiBaseUrl()}.`;
    throw new Error(`${message} Check that the backend is running and the API URL is correct.`);
  }

  if (!response.ok) {
    const isJson = response.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await response.json() : await response.text();
    throw new Error((payload as { error?: string })?.error || "Request failed.");
  }

  return response.blob();
}
