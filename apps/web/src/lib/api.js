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
 * A 401 triggers a single shared refresh + retry. Concurrent requests that all
 * see a 401 share ONE in-flight refresh (single-flight), so we never send the
 * same refresh cookie twice — important because the server revokes the whole
 * session family on refresh-token reuse.
 */
export function makeApi({ getToken, setToken, onAuthFailure }) {
  let refreshInFlight = null;

  function refreshToken() {
    // Coalesce concurrent refreshes into one network call.
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" }
        });
        if (!response.ok) return null;
        const data = await response.json().catch(() => null);
        if (data?.accessToken) setToken?.(data.accessToken);
        return data;
      })().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  // Run a request, and on 401 refresh once (shared) and retry. `send(token)`
  // must build and return a fetch Response for the given access token.
  async function withAuthRetry(send) {
    const token = getToken?.();
    let response = await send(token);
    if (response.status === 401 && token) {
      const refreshed = await refreshToken();
      if (refreshed?.accessToken) {
        response = await send(refreshed.accessToken);
      } else {
        onAuthFailure?.();
        throw new ApiError("Your session expired. Please sign in again.", 401);
      }
    }
    return response;
  }

  async function ensureOk(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new ApiError(getApiErrorMessage(errorData), response.status);
    }
    return response;
  }

  async function request(path, options = {}) {
    const response = await withAuthRetry((token) =>
      fetch(`${API_URL}${path}`, {
        ...options,
        credentials: "include",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {})
        }
      })
    );
    await ensureOk(response);
    if (response.status === 204) return {};
    return response.json();
  }

  async function upload(path, formData) {
    const response = await withAuthRetry((token) =>
      fetch(`${API_URL}${path}`, {
        method: "POST",
        credentials: "include",
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: formData
      })
    );
    await ensureOk(response);
    return response.json();
  }

  async function download(path) {
    const response = await withAuthRetry((token) =>
      fetch(`${API_URL}${path}`, {
        credentials: "include",
        headers: token ? { authorization: `Bearer ${token}` } : {}
      })
    );
    await ensureOk(response);
    return response.blob();
  }

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
    patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
    upload,
    download,
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
