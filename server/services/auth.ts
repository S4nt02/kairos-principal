import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { AdminRole } from "../../shared/types";

const JWT_SECRET = process.env.JWT_SECRET || "kairos-dev-secret-change-in-production";
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "30d";
const ADMIN_TOKEN_EXPIRY = "8h";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Customer Auth ──

export function generateToken(customerId: string): string {
  return jwt.sign({ customerId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): { customerId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.isAdmin) return null; // Reject admin tokens
    return { customerId: payload.customerId };
  } catch {
    return null;
  }
}

// ── Admin Auth (completely separate) ──

export function generateAdminToken(adminUserId: string, role: AdminRole): string {
  return jwt.sign({ adminUserId, role, isAdmin: true }, JWT_SECRET, { expiresIn: ADMIN_TOKEN_EXPIRY });
}

export function verifyAdminToken(token: string): { adminUserId: string; role: AdminRole } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (!payload.isAdmin) return null; // Reject customer tokens
    return { adminUserId: payload.adminUserId, role: payload.role };
  } catch {
    return null;
  }
}
