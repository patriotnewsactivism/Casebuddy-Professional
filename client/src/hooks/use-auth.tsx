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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/check", { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      if (data?.authenticated && data.user) {
        setUser(data.user as AuthUser);
      } else {
        setUser(null);
      }
    } catch {
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
          setUser(null);
          return;
        }
        const data = await res.json();
        if (data?.authenticated && data.user) {
          setUser(data.user as AuthUser);
        } else {
          setUser(null);
        }
      } catch {
        if (active) setUser(null);
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
    const payload = await res.json();
    const authUser = parseAuthUser(payload);
    setUser(authUser);
    return authUser;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/register", { username, password });
    const payload = await res.json();
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
