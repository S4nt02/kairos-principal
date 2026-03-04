import type { Request, Response, NextFunction } from "express";
import { verifyAdminToken } from "../services/auth";
import { storage } from "../storage";
import type { AdminRole } from "../../shared/types";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Autenticação administrativa necessária" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({ message: "Token administrativo inválido ou expirado" });
    return;
  }

  // Verify admin still exists and is active
  storage.getAdminUser(payload.adminUserId).then((admin) => {
    if (!admin || !admin.active) {
      res.status(401).json({ message: "Conta administrativa desativada" });
      return;
    }
    req.adminUserId = payload.adminUserId;
    req.adminRole = payload.role as AdminRole;
    next();
  }).catch(() => {
    res.status(500).json({ message: "Erro ao verificar credenciais" });
  });
}

export function requireRole(...roles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAdmin(req, res, () => {
      // Admin role always has full access
      if (req.adminRole === "admin" || roles.includes(req.adminRole!)) {
        next();
        return;
      }
      res.status(403).json({ message: "Permissão insuficiente" });
    });
  };
}
