import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { CartSummary } from "@shared/types";

const SESSION_KEY = "kairos_cart_session";

function getSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function useCart() {
  const queryClient = useQueryClient();
  const sessionId = getSessionId();
  const queryKey = ["/api/grafica/cart", sessionId];

  const { data: cart, isLoading } = useQuery<CartSummary>({
    queryKey,
  });

  const addItem = useMutation({
    mutationFn: async (data: {
      productId: string;
      variantId?: string;
      quantity: number;
      unitPrice: string;
      specifications?: Record<string, string>;
    }) => {
      const res = await apiRequest("POST", "/api/grafica/cart", {
        sessionId,
        ...data,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const res = await apiRequest("PATCH", `/api/grafica/cart/${id}`, { quantity });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/grafica/cart/item/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/grafica/cart/session/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    cart,
    isLoading,
    sessionId,
    itemCount: cart?.itemCount ?? 0,
    subtotal: cart?.subtotal ?? 0,
    addItem,
    updateItem,
    removeItem,
    clearCart,
  };
}
