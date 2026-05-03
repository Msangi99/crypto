"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";

interface User {
  id: string;
  walletAddress: string;
  username: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: Omit<User, "email" | "isActive" | "createdAt">) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("clb_token");
    if (savedToken) {
      setToken(savedToken);
      api
        .getProfile()
        .then((res) => {
          if (res.success && res.user.role === "ADMIN") {
            setUser(res.user);
          } else {
            localStorage.removeItem("clb_token");
          }
        })
        .catch(() => {
          localStorage.removeItem("clb_token");
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = (newToken: string, userData: Omit<User, "email" | "isActive" | "createdAt">) => {
    localStorage.setItem("clb_token", newToken);
    setToken(newToken);
    setUser({
      ...userData,
      email: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  };

  const logout = () => {
    localStorage.removeItem("clb_token");
    setToken(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const res = await api.getProfile();
      if (res.success) setUser(res.user);
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
