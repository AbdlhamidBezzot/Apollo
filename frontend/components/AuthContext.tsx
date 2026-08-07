"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { clearTokens, get, post, refreshSession } from "@/lib/http";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, refresh: async () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const me = await get<User>("/api/v1/auth/me");
      setUser(me);
    } catch {
      // Fall back to httpOnly cookies (Google OAuth stores tokens only in
      // cookies). Hydrate localStorage from the refresh endpoint, then retry.
      try {
        const ok = await refreshSession();
        if (!ok) {
          setUser(null);
          return;
        }
        const me = await get<User>("/api/v1/auth/me");
        setUser(me);
      } catch {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await post("/api/v1/auth/logout");
    } catch {
      /* ignore network errors */
    }
    clearTokens();
    setUser(null);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
