import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Dados inválidos",
        errors: result.error.flatten().fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// ── Validation Schemas ──

export const addCartItemSchema = z.object({
  sessionId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.string().regex(/^\d+(\.\d{1,4})?$/),
  specifications: z.record(z.string()).optional(),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive(),
});

export const checkoutSchema = z.object({
  sessionId: z.string().min(1),
  customerName: z.string().min(2).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  address: z.object({
    cep: z.string().length(8),
    street: z.string().min(1),
    number: z.string().min(1),
    complement: z.string().optional(),
    neighborhood: z.string().min(1),
    city: z.string().min(1),
    state: z.string().length(2),
  }).optional(),
  shippingOption: z.object({
    carrier: z.string(),
    service: z.string(),
    price: z.number(),
    deliveryDays: z.number(),
    melhorEnvioId: z.number().optional(),
  }).optional(),
  notes: z.string().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "production", "shipped", "delivered", "cancelled"]),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});
