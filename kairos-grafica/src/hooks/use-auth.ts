import { useState, useEffect, useCallback } from "react";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

interface AuthState {
  token: string | null;
  customer: Customer | null;
}

const TOKEN_KEY = "kairos_auth_token";
const CUSTOMER_KEY = "kairos_auth_customer";

function loadState(): AuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(CUSTOMER_KEY);
    const customer = raw ? JSON.parse(raw) : null;
    return { token, customer };
  } catch {
    return { token: null, customer: null };
  }
}

function saveState(token: string, customer: Customer) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
}

function clearState() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_KEY);
}

// Simple event emitter so multiple hook instances stay in sync
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(loadState);

  useEffect(() => {
    const sync = () => setState(loadState());
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/grafica/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao fazer login" }));
      throw new Error(err.message);
    }
    const data = await res.json();
    saveState(data.token, data.customer);
    setState({ token: data.token, customer: data.customer });
    notify();
    return data;
  }, []);

  const register = useCallback(async (name: string, email: string, phone: string, password: string) => {
    const res = await fetch("/api/grafica/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone: phone || undefined, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erro ao criar conta" }));
      throw new Error(err.message);
    }
    const data = await res.json();
    saveState(data.token, data.customer);
    setState({ token: data.token, customer: data.customer });
    notify();
    return data;
  }, []);

  const logout = useCallback(() => {
    clearState();
    setState({ token: null, customer: null });
    notify();
  }, []);

  const refreshUser = useCallback(async () => {
    if (!state.token) return;
    try {
      const res = await fetch("/api/grafica/auth/me", {
        headers: { Authorization: `Bearer ${state.token}` },
      });
      if (res.ok) {
        const customer = await res.json();
        saveState(state.token, customer);
        setState({ token: state.token, customer });
        notify();
      }
    } catch {}
  }, [state.token]);

  return {
    token: state.token,
    customer: state.customer,
    isAuthenticated: !!state.token && !!state.customer,
    login,
    register,
    logout,
    refreshUser,
  };
}
