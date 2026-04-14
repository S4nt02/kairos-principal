import { QueryFunction } from "@tanstack/react-query";
import { getAdminToken } from "../hooks/use-admin-auth";

function getAdminHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function adminApiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAdminHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    try {
      const json = JSON.parse(text);
      throw new Error(json.message || text);
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error(text);
      throw e;
    }
  }

  return res;
}

export function getAdminQueryFn<T>(): QueryFunction<T> {
  return async ({ queryKey }) => {
    const url = queryKey.join("/");
    const res = await fetch(url, {
      headers: getAdminHeaders(),
    });

    if (res.status === 401) {
      // Auto-redirect to admin login
      if (typeof window !== "undefined") {
        localStorage.removeItem("kairos_admin_token");
        localStorage.removeItem("kairos_admin_user");
        window.location.href = "/admin/login";
      }
      throw new Error("Sessão expirada");
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      try {
        const json = JSON.parse(text);
        throw new Error(json.message || text);
      } catch (e) {
        if (e instanceof SyntaxError) throw new Error(text);
        throw e;
      }
    }

    return res.json();
  };
}
