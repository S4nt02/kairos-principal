import { useState, useEffect, useCallback } from "react";
import type { AdminRole } from "../../../shared/types";

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
}

interface AdminAuthState {
  token: string | null;
  user: AdminUser | null;
}

const TOKEN_KEY = "kairos_admin_token";
const USER_KEY = "kairos_admin_user";

function loadState(): AdminAuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    const user = raw ? JSON.parse(raw) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

function saveState(token: string, user: AdminUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearState() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>(loadState);

  useEffect(() => {
    const sync = () => setState(loadState());
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao fazer login" }));
      throw new Error(err.message);
    }
    const data = await res.json();
    saveState(data.token, data.user);
    setState({ token: data.token, user: data.user });
    notify();
    return data;
  }, []);

  const logout = useCallback(() => {
    clearState();
    setState({ token: null, user: null });
    notify();
  }, []);

  const hasRole = useCallback((...roles: AdminRole[]) => {
    if (!state.user) return false;
    if (state.user.role === "admin") return true;
    return roles.includes(state.user.role);
  }, [state.user]);

  return {
    token: state.token,
    user: state.user,
    isAuthenticated: !!state.token && !!state.user,
    login,
    logout,
    hasRole,
  };
}
