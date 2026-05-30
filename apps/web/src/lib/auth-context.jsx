import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { makeApi } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState("");
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Keep a ref so the api client always reads the latest token without being
  // re-created on every token rotation.
  const tokenRef = useRef("");
  tokenRef.current = accessToken;

  const api = useMemo(
    () =>
      makeApi({
        getToken: () => tokenRef.current,
        setToken: (token) => setAccessToken(token),
        onAuthFailure: () => {
          setAccessToken("");
          setUser(null);
        }
      }),
    []
  );

  // Restore an existing session from the HttpOnly refresh cookie on first load.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const refreshed = await api.refreshToken();
        if (active && refreshed?.accessToken) {
          setAccessToken(refreshed.accessToken);
          setUser(refreshed.user || null);
        }
      } catch (_error) {
        // No valid session; fall through to the login screen.
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [api]);

  async function login({ email, password }) {
    const result = await api.post("/auth/login", { email, password });
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }

  async function register({ name, email, password }) {
    await api.post("/auth/register", { name, email, password });
  }

  async function logout() {
    try {
      await api.post("/auth/logout", {});
    } catch (_error) {
      // Best-effort; clear local state regardless.
    }
    setAccessToken("");
    setUser(null);
  }

  const value = {
    api,
    user,
    isAuthenticated: Boolean(accessToken),
    initializing,
    login,
    register,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function RequireAuth({ children }) {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading your workspace…
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
