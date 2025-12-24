import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

type AuthUser = {
  id: string;
  username: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  register: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function parseAuthUser(payload: unknown): AuthUser {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid authentication response");
  }
  const data = payload as { user?: AuthUser };
  if (!data.user?.id || !data.user?.username) {
    throw new Error("Invalid authentication response");
  }
  return data.user;
}

async function parseJsonResponse(res: Response, context: string) {
  const contentType = res.headers.get("content-type");
  const bodyText = await res.text();

  if (!contentType?.includes("application/json")) {
    const preview = bodyText.slice(0, 200).trim();
    const responseHint = preview ? ` Response preview: ${preview}` : "";
    throw new Error(
      `${context} failed: received a non-JSON response from the server. Please ensure the API is reachable and try again.${responseHint}`,
    );
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error(`${context} failed: unable to parse the server response.`);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/check", { credentials: "include" });
      if (!res.ok) {
        queryClient.clear();
        setUser(null);
        return;
      }
      const data = await res.json();
      if (data?.authenticated && data.user) {
        setUser(data.user as AuthUser);
      } else {
        queryClient.clear();
        setUser(null);
      }
    } catch {
      queryClient.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/check", { credentials: "include" });
        if (!active) return;
        if (!res.ok) {
          queryClient.clear();
          setUser(null);
          return;
        }
        const data = await res.json();
        if (data?.authenticated && data.user) {
          setUser(data.user as AuthUser);
        } else {
          queryClient.clear();
          setUser(null);
        }
      } catch {
        if (active) {
          queryClient.clear();
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { username, password });
    const payload = await parseJsonResponse(res, "Login");
    const authUser = parseAuthUser(payload);
    setUser(authUser);
    return authUser;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/register", { username, password });
    const payload = await parseJsonResponse(res, "Registration");
    const authUser = parseAuthUser(payload);
    setUser(authUser);
    return authUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } finally {
      queryClient.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
