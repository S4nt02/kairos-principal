import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth";
import type { AdminRole } from "../../shared/types";

// Extend Express Request to include customerId and admin fields
declare global {
  namespace Express {
    interface Request {
      customerId?: string;
      adminUserId?: string;
      adminRole?: AdminRole;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Autenticação necessária" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ message: "Token inválido ou expirado" });
    return;
  }

  req.customerId = payload.customerId;
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      req.customerId = payload.customerId;
    }
  }
  next();
}
