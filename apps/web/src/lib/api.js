const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Build an authenticated fetch client.
 *
 * Fixes the original 401 handling, which refreshed the token but never retried
 * the failed request. Now a 401 triggers one refresh + retry; if the refresh
 * fails we surface an auth error so the caller can redirect to login.
 */
export function makeApi({ getToken, setToken, onAuthFailure }) {
  async function rawFetch(path, options, token) {
    return fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  }

  async function refreshToken() {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" }
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    if (data?.accessToken) setToken?.(data.accessToken);
    return data;
  }

  async function request(path, options = {}) {
    let token = getToken?.();
    let response = await rawFetch(path, options, token);

    if (response.status === 401 && token) {
      const refreshed = await refreshToken();
      if (refreshed?.accessToken) {
        // Retry the original request with the rotated token.
        response = await rawFetch(path, options, refreshed.accessToken);
      } else {
        onAuthFailure?.();
        throw new ApiError("Your session expired. Please sign in again.", 401);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new ApiError(getApiErrorMessage(errorData), response.status);
    }
    if (response.status === 204) return {};
    return response.json();
  }

  async function upload(path, formData) {
    let token = getToken?.();
    const doUpload = (authToken) =>
      fetch(`${API_URL}${path}`, {
        method: "POST",
        credentials: "include",
        headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
        body: formData
      });

    let response = await doUpload(token);
    if (response.status === 401 && token) {
      const refreshed = await refreshToken();
      if (refreshed?.accessToken) {
        response = await doUpload(refreshed.accessToken);
      } else {
        onAuthFailure?.();
        throw new ApiError("Your session expired. Please sign in again.", 401);
      }
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new ApiError(getApiErrorMessage(errorData), response.status);
    }
    return response.json();
  }

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
    patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
    upload,
    refreshToken,
    apiUrl: API_URL
  };
}

export function getApiErrorMessage(errorData) {
  if (Array.isArray(errorData)) {
    return errorData[0]?.message || "Request failed";
  }
  if (Array.isArray(errorData?.errors)) {
    return errorData.errors[0]?.message || "Request failed";
  }
  if (Array.isArray(errorData?.error)) {
    return errorData.error[0]?.message || "Request failed";
  }
  if (typeof errorData?.error === "string" && errorData.error.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(errorData.error);
      if (parsed[0]?.message) return parsed[0].message;
    } catch (_error) {
      // Fall back to the plain error string below.
    }
  }
  return errorData?.error || errorData?.message || "Request failed";
}

/** Shared helpers carried over from the original single-file app. */
export function formatImportNotice(run, label, completionMessage) {
  if (run?.status === "failed") {
    return `${label} failed: ${run.error || "Apify could not start the run."}`;
  }
  if (run?.status === "pending") {
    return `${label} pending: ${run.error || "Apify is not configured yet."}`;
  }
  return `${label} started: ${run?.status || "running"}. ${completionMessage}`;
}
