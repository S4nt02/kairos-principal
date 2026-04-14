// server/vercel-entry.ts
import { createServer } from "http";
import express from "express";
import helmet from "helmet";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./shared/schema.js";

// server/storage.ts
import {
  eq, asc, desc, and, or, ilike, gte, lte, count, sql
} from "drizzle-orm";

// server/routes.ts
import { randomUUID, createHmac, timingSafeEqual } from "crypto";

// server/middleware/validate.ts
import { z as external_exports } from "zod";

// server/services/auth.ts
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";

// server/services/mercadopago.ts
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

// server/services/shipping.ts
// (uses fetch — no import needed in Node 18+)

// server/middleware/admin-auth.ts
// (uses verifyAdminToken from auth.ts)

// server/middleware/rate-limit.ts
import rateLimit from "express-rate-limit";

// server/services/email.ts
import { Resend } from "resend";

// server/services/storage-client.ts
import { createClient } from "@supabase/supabase-js";

// server/routes/admin.ts
import multer from "multer";

// ── DB ────────────────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Please set it in your .env file.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const {
  users, categories, products, productVariants, paperTypes, finishings,
  priceRules, cartItems, customers, addresses, orders, orderItems,
  adminUsers, auditLog, storeSettings, coupons, orderNotes,
  estrategiaPlans, estrategiaSteps
} = schema;

// ── Storage ───────────────────────────────────────────────────────────────────

class DatabaseStorage {
  // ── Users ──
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  // ── Gráfica: Catalog ──
  async getCategories() {
    return db.select().from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sortOrder));
  }
  async getCategoryBySlug(slug) {
    const [cat] = await db.select().from(categories).where(and(eq(categories.slug, slug), eq(categories.active, true)));
    return cat;
  }
  async getProductsByCategory(categoryId) {
    return db.select().from(products).where(and(eq(products.categoryId, categoryId), eq(products.active, true)));
  }
  async getProductBySlug(slug) {
    const [product] = await db.select().from(products).where(and(eq(products.slug, slug), eq(products.active, true)));
    return product;
  }
  async getProductVariants(productId) {
    return db.select().from(productVariants).where(eq(productVariants.productId, productId));
  }
  async getPaperTypes() {
    return db.select().from(paperTypes).where(eq(paperTypes.active, true)).orderBy(asc(paperTypes.sortOrder));
  }
  async getFinishings() {
    return db.select().from(finishings).where(eq(finishings.active, true)).orderBy(asc(finishings.sortOrder));
  }
  async getPriceRules(productId) {
    return db.select().from(priceRules).where(eq(priceRules.productId, productId)).orderBy(asc(priceRules.minQty));
  }
  async getProductCountByCategory(categoryId) {
    const [result] = await db.select({ count: count() }).from(products).where(and(eq(products.categoryId, categoryId), eq(products.active, true)));
    return Number(result?.count || 0);
  }
  async searchProducts(query, limit = 20) {
    return db.select().from(products).where(and(
      eq(products.active, true),
      or(
        ilike(products.name, `%${query}%`),
        ilike(products.description, `%${query}%`)
      )
    )).limit(limit);
  }
  // ── Customers ──
  async createCustomer(data) {
    const [customer] = await db.insert(customers).values(data).returning();
    return customer;
  }
  async getCustomerByEmail(email) {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    return customer;
  }
  async getCustomer(id) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }
  async updateCustomer(id, data) {
    const [updated] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
    return updated;
  }
  // ── Addresses ──
  async getAddressesByCustomer(customerId) {
    return db.select().from(addresses).where(eq(addresses.customerId, customerId));
  }
  async getAddress(id) {
    const [addr] = await db.select().from(addresses).where(eq(addresses.id, id));
    return addr;
  }
  async createAddress(data) {
    if (data.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.customerId, data.customerId));
    }
    const [addr] = await db.insert(addresses).values(data).returning();
    return addr;
  }
  async updateAddress(id, data) {
    if (data.isDefault) {
      const existing = await this.getAddress(id);
      if (existing) {
        await db.update(addresses).set({ isDefault: false }).where(eq(addresses.customerId, existing.customerId));
      }
    }
    const [updated] = await db.update(addresses).set(data).where(eq(addresses.id, id)).returning();
    return updated;
  }
  async deleteAddress(id) {
    await db.delete(addresses).where(eq(addresses.id, id));
  }
  // ── Cart ──
  async getCartItems(sessionId) {
    return db.select().from(cartItems).where(eq(cartItems.sessionId, sessionId));
  }
  async addCartItem(item) {
    const [cartItem] = await db.insert(cartItems).values(item).returning();
    return cartItem;
  }
  async updateCartItem(id, quantity) {
    const [updated] = await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, id)).returning();
    return updated;
  }
  async removeCartItem(id) {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  }
  async clearCart(sessionId) {
    await db.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
  }
  // ── Orders ──
  async createOrder(order) {
    const [created] = await db.insert(orders).values(order).returning();
    return created;
  }
  async getOrder(id) {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }
  async getAllOrders() {
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }
  async getOrdersByCustomer(customerId) {
    return db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt));
  }
  async updateOrderStatus(id, status) {
    const [updated] = await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
    return updated;
  }
  async updatePaymentStatus(id, paymentStatus, externalId) {
    const values = { paymentStatus, updatedAt: new Date() };
    if (externalId) values.paymentExternalId = externalId;
    const [updated] = await db.update(orders).set(values).where(eq(orders.id, id)).returning();
    return updated;
  }
  async addOrderItems(items) {
    if (items.length === 0) return [];
    return db.insert(orderItems).values(items).returning();
  }
  async getOrderItems(orderId) {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }
  async getOrderItemById(id) {
    const [item] = await db.select().from(orderItems).where(eq(orderItems.id, id));
    return item;
  }
  async updateOrderItemArt(id, artFileUrl, artStatus) {
    const [updated] = await db.update(orderItems).set({ artFileUrl, artStatus }).where(eq(orderItems.id, id)).returning();
    return updated;
  }
  // ── Admin Users ──
  async getAdminUsers() {
    return db.select().from(adminUsers).orderBy(asc(adminUsers.createdAt));
  }
  async getAdminUser(id) {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return admin;
  }
  async getAdminUserByEmail(email) {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return admin;
  }
  async createAdminUser(data) {
    const [admin] = await db.insert(adminUsers).values(data).returning();
    return admin;
  }
  async updateAdminUser(id, data) {
    const [updated] = await db.update(adminUsers).set(data).where(eq(adminUsers.id, id)).returning();
    return updated;
  }
  async deleteAdminUser(id) {
    await db.delete(adminUsers).where(eq(adminUsers.id, id));
  }
  async updateAdminUserLastLogin(id) {
    await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, id));
  }
  // ── Audit Log ──
  async createAuditLog(data) {
    const [log] = await db.insert(auditLog).values(data).returning();
    return log;
  }
  async getAuditLogs(params) {
    const conditions = [];
    if (params.adminUserId) conditions.push(eq(auditLog.adminUserId, params.adminUserId));
    if (params.entityType) conditions.push(eq(auditLog.entityType, params.entityType));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (params.page - 1) * params.pageSize;
    const [data, [{ total }]] = await Promise.all([
      db.select().from(auditLog).where(where).orderBy(desc(auditLog.createdAt)).limit(params.pageSize).offset(offset),
      db.select({ total: count() }).from(auditLog).where(where)
    ]);
    return { data, total: Number(total) };
  }
  // ── Store Settings ──
  async getSetting(key) {
    const [setting] = await db.select().from(storeSettings).where(eq(storeSettings.key, key));
    return setting?.value;
  }
  async setSetting(key, value) {
    await db.insert(storeSettings).values({ key, value, updatedAt: new Date() }).onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedAt: new Date() } });
  }
  async getAllSettings() {
    return db.select().from(storeSettings);
  }
  // ── Dashboard Aggregations ──
  async getDashboardKPIs(dateFrom, dateTo) {
    const [result] = await db.select({
      revenue: sql`COALESCE(SUM(CAST(${orders.total} AS numeric)), 0)`,
      orders: count(),
      avgTicket: sql`COALESCE(AVG(CAST(${orders.total} AS numeric)), 0)`
    }).from(orders).where(and(gte(orders.createdAt, dateFrom), lte(orders.createdAt, dateTo)));
    const [custResult] = await db.select({ newCustomers: count() }).from(customers).where(and(gte(customers.createdAt, dateFrom), lte(customers.createdAt, dateTo)));
    return {
      revenue: Number(result?.revenue || 0),
      orders: Number(result?.orders || 0),
      newCustomers: Number(custResult?.newCustomers || 0),
      avgTicket: Number(result?.avgTicket || 0)
    };
  }
  async getRevenueByPeriod(dateFrom, dateTo, granularity) {
    const truncExpr = granularity === "month" ? sql`date_trunc('month', ${orders.createdAt})` : sql`date_trunc('day', ${orders.createdAt})`;
    const result = await db.select({
      date: sql`${truncExpr}::text`,
      revenue: sql`COALESCE(SUM(CAST(${orders.total} AS numeric)), 0)`
    }).from(orders).where(and(gte(orders.createdAt, dateFrom), lte(orders.createdAt, dateTo))).groupBy(truncExpr).orderBy(truncExpr);
    return result.map((r) => ({ date: r.date, revenue: Number(r.revenue) }));
  }
  async getOrderStatusDistribution() {
    const result = await db.select({ status: orders.status, count: count() }).from(orders).groupBy(orders.status);
    return result.map((r) => ({ status: r.status, count: Number(r.count) }));
  }
  async getTopProducts(limit, dateFrom, dateTo) {
    const result = await db.select({
      productId: orderItems.productId,
      productName: orderItems.productName,
      revenue: sql`COALESCE(SUM(CAST(${orderItems.subtotal} AS numeric)), 0)`,
      quantity: sql`COALESCE(SUM(${orderItems.quantity}), 0)`
    }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(gte(orders.createdAt, dateFrom), lte(orders.createdAt, dateTo))).groupBy(orderItems.productId, orderItems.productName).orderBy(sql`SUM(CAST(${orderItems.subtotal} AS numeric)) DESC`).limit(limit);
    return result.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      revenue: Number(r.revenue),
      quantity: Number(r.quantity)
    }));
  }
  async getOrdersPaginated(params) {
    const conditions = [];
    if (params.status) conditions.push(eq(orders.status, params.status));
    if (params.paymentStatus) conditions.push(eq(orders.paymentStatus, params.paymentStatus));
    if (params.customerId) conditions.push(eq(orders.customerId, params.customerId));
    if (params.dateFrom) conditions.push(gte(orders.createdAt, params.dateFrom));
    if (params.dateTo) conditions.push(lte(orders.createdAt, params.dateTo));
    if (params.search) conditions.push(or(ilike(orders.id, `%${params.search}%`), ilike(orders.notes, `%${params.search}%`)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (params.page - 1) * params.pageSize;
    const [data, [{ total }]] = await Promise.all([
      db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(params.pageSize).offset(offset),
      db.select({ total: count() }).from(orders).where(where)
    ]);
    return { data, total: Number(total) };
  }
  // ── Admin: Catalog CRUD ──
  async getAllCategoriesAdmin() {
    return db.select().from(categories).orderBy(asc(categories.sortOrder));
  }
  async getCategoryById(id) {
    const [cat] = await db.select().from(categories).where(eq(categories.id, id));
    return cat;
  }
  async createCategory(data) {
    const [cat] = await db.insert(categories).values(data).returning();
    return cat;
  }
  async updateCategory(id, data) {
    const [cat] = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
    return cat;
  }
  async deleteCategory(id) {
    await db.delete(categories).where(eq(categories.id, id));
  }
  async getAllProductsAdmin(params) {
    const conditions = [];
    if (params.categoryId) conditions.push(eq(products.categoryId, params.categoryId));
    if (params.search) conditions.push(ilike(products.name, `%${params.search}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (params.page - 1) * params.pageSize;
    const [data, [{ total }]] = await Promise.all([
      db.select().from(products).where(where).orderBy(desc(products.createdAt)).limit(params.pageSize).offset(offset),
      db.select({ total: count() }).from(products).where(where)
    ]);
    return { data, total: Number(total) };
  }
  async getProductById(id) {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }
  async createProduct(data) {
    const [product] = await db.insert(products).values(data).returning();
    return product;
  }
  async updateProduct(id, data) {
    const [product] = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return product;
  }
  async deleteProduct(id) {
    await db.delete(products).where(eq(products.id, id));
  }
  async createProductVariant(data) {
    const [variant] = await db.insert(productVariants).values(data).returning();
    return variant;
  }
  async updateProductVariant(id, data) {
    const [variant] = await db.update(productVariants).set(data).where(eq(productVariants.id, id)).returning();
    return variant;
  }
  async deleteProductVariant(id) {
    await db.delete(productVariants).where(eq(productVariants.id, id));
  }
  async getAllPaperTypesAdmin() {
    return db.select().from(paperTypes).orderBy(asc(paperTypes.sortOrder));
  }
  async createPaperType(data) {
    const [paper] = await db.insert(paperTypes).values(data).returning();
    return paper;
  }
  async updatePaperType(id, data) {
    const [paper] = await db.update(paperTypes).set(data).where(eq(paperTypes.id, id)).returning();
    return paper;
  }
  async deletePaperType(id) {
    await db.delete(paperTypes).where(eq(paperTypes.id, id));
  }
  async getAllFinishingsAdmin() {
    return db.select().from(finishings).orderBy(asc(finishings.sortOrder));
  }
  async createFinishing(data) {
    const [finishing] = await db.insert(finishings).values(data).returning();
    return finishing;
  }
  async updateFinishing(id, data) {
    const [finishing] = await db.update(finishings).set(data).where(eq(finishings.id, id)).returning();
    return finishing;
  }
  async deleteFinishing(id) {
    await db.delete(finishings).where(eq(finishings.id, id));
  }
  async createPriceRule(data) {
    const [rule] = await db.insert(priceRules).values(data).returning();
    return rule;
  }
  async updatePriceRule(id, data) {
    const [rule] = await db.update(priceRules).set(data).where(eq(priceRules.id, id)).returning();
    return rule;
  }
  async deletePriceRule(id) {
    await db.delete(priceRules).where(eq(priceRules.id, id));
  }
  // ── Admin: Customers ──
  async getAllCustomers(params) {
    const conditions = [];
    if (params.search) conditions.push(or(ilike(customers.name, `%${params.search}%`), ilike(customers.email, `%${params.search}%`)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (params.page - 1) * params.pageSize;
    const [data, [{ total }]] = await Promise.all([
      db.select().from(customers).where(where).orderBy(desc(customers.createdAt)).limit(params.pageSize).offset(offset),
      db.select({ total: count() }).from(customers).where(where)
    ]);
    const enriched = await Promise.all(data.map(async (customer) => {
      const [stats] = await db.select({
        orderCount: count(),
        totalSpent: sql`COALESCE(SUM(CAST(${orders.total} AS numeric)), 0)`
      }).from(orders).where(eq(orders.customerId, customer.id));
      return { ...customer, orderCount: Number(stats?.orderCount || 0), totalSpent: Number(stats?.totalSpent || 0) };
    }));
    return { data: enriched, total: Number(total) };
  }
  // ── Admin: Reports ──
  async getPaymentStatusBreakdown(dateFrom, dateTo) {
    const result = await db.select({
      status: orders.paymentStatus,
      count: count(),
      total: sql`COALESCE(SUM(CAST(${orders.total} AS numeric)), 0)`
    }).from(orders).where(and(gte(orders.createdAt, dateFrom), lte(orders.createdAt, dateTo))).groupBy(orders.paymentStatus);
    return result.map((r) => ({ status: r.status, count: Number(r.count), total: Number(r.total) }));
  }
  async getMonthlyComparison(months) {
    const result = await db.select({
      period: sql`to_char(date_trunc('month', ${orders.createdAt}), 'YYYY-MM')`,
      revenue: sql`COALESCE(SUM(CAST(${orders.total} AS numeric)), 0)`,
      orders: count(),
      avgTicket: sql`COALESCE(AVG(CAST(${orders.total} AS numeric)), 0)`
    }).from(orders).where(gte(orders.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(months))} months'`)).groupBy(sql`date_trunc('month', ${orders.createdAt})`).orderBy(sql`date_trunc('month', ${orders.createdAt})`);
    return result.map((r) => ({
      period: r.period,
      revenue: Number(r.revenue),
      orders: Number(r.orders),
      avgTicket: Number(r.avgTicket)
    }));
  }
  // ── Shipping label ──
  async updateShippingLabel(id, labelUrl) {
    const [updated] = await db.update(orders).set({ shippingLabelUrl: labelUrl, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
    return updated;
  }
  async updateOrderTracking(id, trackingCode) {
    const [updated] = await db.update(orders).set({ shippingTrackingCode: trackingCode, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
    return updated;
  }
  // ── Coupons ──
  async getCouponByCode(code) {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    return coupon;
  }
  async incrementCouponUses(id) {
    await db.update(coupons).set({ currentUses: sql`${coupons.currentUses} + 1` }).where(eq(coupons.id, id));
  }
  async createCoupon(data) {
    const [coupon] = await db.insert(coupons).values({ ...data, code: data.code.toUpperCase() }).returning();
    return coupon;
  }
  async updateCoupon(id, data) {
    const updateData = { ...data };
    if (updateData.code) updateData.code = updateData.code.toUpperCase();
    const [coupon] = await db.update(coupons).set(updateData).where(eq(coupons.id, id)).returning();
    return coupon;
  }
  async deleteCoupon(id) {
    await db.delete(coupons).where(eq(coupons.id, id));
  }
  async getAllCoupons() {
    return db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }
  // ── Order Notes ──
  async getOrderNotes(orderId) {
    return db.select().from(orderNotes).where(eq(orderNotes.orderId, orderId)).orderBy(desc(orderNotes.createdAt));
  }
  async createOrderNote(data) {
    const [note] = await db.insert(orderNotes).values(data).returning();
    return note;
  }
  // ── Estratégia de Conteúdo ──
  async getActiveEstrategiaPlans() {
    return db.select().from(estrategiaPlans).where(eq(estrategiaPlans.active, true)).orderBy(asc(estrategiaPlans.sortOrder));
  }
  async getAllEstrategiaPlans() {
    return db.select().from(estrategiaPlans).orderBy(asc(estrategiaPlans.sortOrder));
  }
  async createEstrategiaPlan(data) {
    const [plan] = await db.insert(estrategiaPlans).values(data).returning();
    return plan;
  }
  async updateEstrategiaPlan(id, data) {
    const [plan] = await db.update(estrategiaPlans).set(data).where(eq(estrategiaPlans.id, id)).returning();
    return plan;
  }
  async deleteEstrategiaPlan(id) {
    await db.delete(estrategiaPlans).where(eq(estrategiaPlans.id, id));
  }
  async getAllEstrategiaSteps() {
    return db.select().from(estrategiaSteps).orderBy(asc(estrategiaSteps.sortOrder));
  }
  async createEstrategiaStep(data) {
    const [step] = await db.insert(estrategiaSteps).values(data).returning();
    return step;
  }
  async updateEstrategiaStep(id, data) {
    const [step] = await db.update(estrategiaSteps).set(data).where(eq(estrategiaSteps.id, id)).returning();
    return step;
  }
  async deleteEstrategiaStep(id) {
    await db.delete(estrategiaSteps).where(eq(estrategiaSteps.id, id));
  }
}

const storage = new DatabaseStorage();

// ── Middleware: validate ───────────────────────────────────────────────────────

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
      return;
    }
    req.body = result.data;
    next();
  };
}

const addCartItemSchema = external_exports.object({
  sessionId: external_exports.string().min(1),
  productId: external_exports.string().min(1),
  variantId: external_exports.string().optional(),
  quantity: external_exports.number().int().positive(),
  unitPrice: external_exports.string().regex(/^\d+(\.\d{1,4})?$/),
  specifications: external_exports.record(external_exports.string()).optional()
});
const updateCartItemSchema = external_exports.object({ quantity: external_exports.number().int().positive() });
const checkoutSchema = external_exports.object({
  sessionId: external_exports.string().min(1),
  customerName: external_exports.string().min(2).optional(),
  customerEmail: external_exports.string().email().optional(),
  customerPhone: external_exports.string().optional(),
  address: external_exports.object({
    cep: external_exports.string().length(8),
    street: external_exports.string().min(1),
    number: external_exports.string().min(1),
    complement: external_exports.string().optional(),
    neighborhood: external_exports.string().min(1),
    city: external_exports.string().min(1),
    state: external_exports.string().length(2)
  }).optional(),
  shippingOption: external_exports.object({
    carrier: external_exports.string(),
    service: external_exports.string(),
    price: external_exports.number(),
    deliveryDays: external_exports.number(),
    melhorEnvioId: external_exports.number().optional()
  }).optional(),
  notes: external_exports.string().optional(),
  couponCode: external_exports.string().optional()
});
const updateStatusSchema = external_exports.object({
  status: external_exports.enum(["pending", "confirmed", "production", "shipped", "delivered", "cancelled"])
});
const registerSchema = external_exports.object({
  name: external_exports.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: external_exports.string().email("E-mail inválido"),
  phone: external_exports.string().optional(),
  password: external_exports.string().min(6, "Senha deve ter pelo menos 6 caracteres")
});
const loginSchema = external_exports.object({
  email: external_exports.string().email("E-mail inválido"),
  password: external_exports.string().min(1, "Senha é obrigatória")
});
const createAddressSchema = external_exports.object({
  label: external_exports.string().min(1, "Label é obrigatório"),
  cep: external_exports.string().regex(/^\d{8}$/, "CEP deve ter 8 dígitos"),
  street: external_exports.string().min(1, "Rua é obrigatória"),
  number: external_exports.string().min(1, "Número é obrigatório"),
  complement: external_exports.string().optional(),
  neighborhood: external_exports.string().min(1, "Bairro é obrigatório"),
  city: external_exports.string().min(1, "Cidade é obrigatória"),
  state: external_exports.string().length(2, "Estado deve ter 2 caracteres"),
  isDefault: external_exports.boolean().optional()
});
const updateAddressSchema = createAddressSchema.partial();
const updateProfileSchema = external_exports.object({
  name: external_exports.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
  phone: external_exports.string().optional()
});
const changePasswordSchema = external_exports.object({
  currentPassword: external_exports.string().min(1, "Senha atual é obrigatória"),
  newPassword: external_exports.string().min(6, "Nova senha deve ter pelo menos 6 caracteres")
});

// ── Services: auth ────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "kairos-dev-secret-change-in-production";
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "30d";
const ADMIN_TOKEN_EXPIRY = "8h";

async function hashPassword(password) {
  
  return bcryptjs.hash(password, SALT_ROUNDS);
}
async function verifyPassword(password, hash) {
  return bcryptjs.compare(password, hash);
}
function generateToken(customerId) {
  return jwt.sign({ customerId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.isAdmin) return null;
    return { customerId: payload.customerId };
  } catch {
    return null;
  }
}
function generateAdminToken(adminUserId, role) {
  return jwt.sign({ adminUserId, role, isAdmin: true }, JWT_SECRET, { expiresIn: ADMIN_TOKEN_EXPIRY });
}
function verifyAdminToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.isAdmin) return null;
    return { adminUserId: payload.adminUserId, role: payload.role };
  } catch {
    return null;
  }
}

// ── Middleware: auth ──────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
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

// ── Services: MercadoPago ─────────────────────────────────────────────────────

if (!process.env.MP_ACCESS_TOKEN) {
  console.warn("[MercadoPago] MP_ACCESS_TOKEN is not set. Payment integration will fail.");
}

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "",
  options: { timeout: 10000 }
});
const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);
const SITE_URL = (process.env.SITE_URL || "http://localhost:5000").trim().replace(/\/+$/, "");

async function createPreference(input) {
  const { orderId, items, shippingCost, discountAmount = 0, payer } = input;
  const mpItems = items.map((item) => ({
    id: item.id,
    title: item.title,
    quantity: item.quantity,
    unit_price: item.unit_price,
    currency_id: "BRL"
  }));
  if (shippingCost > 0) {
    mpItems.push({ id: "shipping", title: "Frete", quantity: 1, unit_price: parseFloat(shippingCost.toFixed(2)), currency_id: "BRL" });
  }
  if (discountAmount > 0) {
    const itemsTotal = mpItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    if (itemsTotal > 0) {
      for (const item of mpItems) {
        if (item.id === "shipping") continue;
        const proportion = item.unit_price * item.quantity / itemsTotal;
        const itemDiscount = discountAmount * proportion / item.quantity;
        item.unit_price = parseFloat(Math.max(item.unit_price - itemDiscount, 0.01).toFixed(2));
      }
    }
  }
  const isLocalDev = SITE_URL.includes("localhost") || SITE_URL.includes("127.0.0.1");
  const preferenceBody = {
    items: mpItems,
    payer: { name: payer.name, email: payer.email },
    back_urls: {
      success: `${SITE_URL}/grafica/pedido/${orderId}?mp_status=approved`,
      failure: `${SITE_URL}/grafica/pedido/${orderId}?mp_status=rejected`,
      pending: `${SITE_URL}/grafica/pedido/${orderId}?mp_status=pending`
    },
    external_reference: orderId,
    statement_descriptor: "KAIROS GRAFICA"
  };
  if (!isLocalDev) {
    preferenceBody.auto_return = "all";
    preferenceBody.notification_url = `${SITE_URL}/api/webhooks/mercadopago`;
    preferenceBody.expires = true;
    preferenceBody.expiration_date_to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }
  const result = await preferenceClient.create({ body: preferenceBody });
  return { preferenceId: result.id, initPoint: result.init_point, sandboxInitPoint: result.sandbox_init_point };
}

async function getPayment(paymentId) {
  const payment = await paymentClient.get({ id: paymentId });
  return {
    id: payment.id,
    status: payment.status,
    statusDetail: payment.status_detail,
    externalReference: payment.external_reference,
    transactionAmount: payment.transaction_amount,
    paymentMethodId: payment.payment_method_id,
    paymentTypeId: payment.payment_type_id,
    dateApproved: payment.date_approved
  };
}

async function createRefund(paymentId, amount) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN not configured");
  const body = {};
  if (amount !== undefined) body.amount = amount;
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MercadoPago refund error ${response.status}: ${text}`);
  }
  const data = await response.json();
  return { refundId: String(data.id), status: data.status };
}

function mapPaymentStatus(mpStatus) {
  switch (mpStatus) {
    case "approved": return { orderStatus: "confirmed", paymentStatus: "approved" };
    case "pending": case "in_process": case "authorized": return { orderStatus: "pending", paymentStatus: "pending" };
    case "rejected": return { orderStatus: "pending", paymentStatus: "rejected" };
    case "cancelled": return { orderStatus: "cancelled", paymentStatus: "rejected" };
    case "refunded": case "charged_back": return { orderStatus: "cancelled", paymentStatus: "refunded" };
    default: return { orderStatus: "pending", paymentStatus: "pending" };
  }
}

function mapPaymentMethod(paymentTypeId) {
  switch (paymentTypeId) {
    case "credit_card": case "debit_card": return "card";
    case "bank_transfer": return "pix";
    case "ticket": return "boleto";
    default: return "mercadopago";
  }
}

// ── Services: Shipping ────────────────────────────────────────────────────────

const MELHOR_ENVIO_TOKEN = process.env.MELHOR_ENVIO_TOKEN || "";
const WAREHOUSE_CEP = process.env.WAREHOUSE_CEP || "01001000";
const IS_SANDBOX = process.env.MELHOR_ENVIO_SANDBOX !== "false";
const BASE_URL = IS_SANDBOX ? "https://sandbox.melhorenvio.com.br" : "https://api.melhorenvio.com.br";
const MOCK_QUOTES = [
  { carrier: "Correios", service: "PAC", price: 18.9, deliveryDays: 8 },
  { carrier: "Correios", service: "SEDEX", price: 32.5, deliveryDays: 3 },
  { carrier: "Jadlog", service: ".Package", price: 22.4, deliveryDays: 5 }
];

async function calculatePackage(items) {
  if (items.length === 0) return { weightKg: 5, widthCm: 23, heightCm: 12, lengthCm: 34 };
  const allPaperTypes = await storage.getPaperTypes();
  const paperMap = new Map(allPaperTypes.map((p) => [p.id, p]));
  let totalWeightKg = 0, maxWidthMm = 0, maxHeightMm = 0, totalThicknessMm = 0;
  for (const item of items) {
    let widthMm = 210, heightMm = 297, weightGsm = 90;
    if (item.variantId) {
      const variants = await storage.getProductVariants(item.productId);
      const variant = variants.find((v) => v.id === item.variantId);
      if (variant) {
        widthMm = variant.widthMm;
        heightMm = variant.heightMm;
        const paper = paperMap.get(variant.paperTypeId);
        if (paper) weightGsm = paper.weightGsm;
      }
    }
    const areaSqM = widthMm / 1000 * (heightMm / 1000);
    totalWeightKg += weightGsm * areaSqM * item.quantity / 1000;
    if (widthMm > maxWidthMm) maxWidthMm = widthMm;
    if (heightMm > maxHeightMm) maxHeightMm = heightMm;
    totalThicknessMm += weightGsm / 900 * item.quantity;
  }
  return {
    weightKg: Math.max(totalWeightKg, 0.3),
    widthCm: Math.max(Math.ceil(maxWidthMm / 10) + 2, 11),
    heightCm: Math.max(Math.ceil(totalThicknessMm / 10) + 2, 4),
    lengthCm: Math.max(Math.ceil(maxHeightMm / 10) + 2, 16)
  };
}

async function calculateShipping(input) {
  if (!MELHOR_ENVIO_TOKEN) return MOCK_QUOTES;
  const pkg = await calculatePackage(input.items);
  const insuredValue = input.insuredValue ?? input.items.reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0);
  const body = {
    from: { postal_code: WAREHOUSE_CEP },
    to: { postal_code: input.destinationCep },
    package: { weight: pkg.weightKg, width: pkg.widthCm, height: pkg.heightCm, length: pkg.lengthCm },
    options: { insurance_value: Math.max(insuredValue, 1), receipt: false, own_hand: false }
  };
  try {
    const response = await fetch(`${BASE_URL}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Accept: "application/json", "Content-Type": "application/json",
        Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
        "User-Agent": "Kairos Grafica (contato@kairos.com.br)"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) return MOCK_QUOTES;
    const data = await response.json();
    const quotes = data.filter((q) => !q.error && q.price).map((q) => ({
      carrier: q.company.name, service: q.name,
      price: parseFloat(q.price) - parseFloat(q.discount || "0"),
      deliveryDays: q.delivery_range?.max ?? q.delivery_time,
      melhorEnvioId: q.id
    })).sort((a, b) => a.price - b.price);
    return quotes.length > 0 ? quotes : MOCK_QUOTES;
  } catch {
    return MOCK_QUOTES;
  }
}

const WAREHOUSE_FROM = {
  name: process.env.WAREHOUSE_NAME || "Kairos Gráfica",
  phone: process.env.WAREHOUSE_PHONE || "11999999999",
  email: process.env.WAREHOUSE_EMAIL || "contato@kairos.com.br",
  document: process.env.WAREHOUSE_DOCUMENT || "12345678909",
  address: process.env.WAREHOUSE_ADDRESS || "Praça da Sé",
  number: process.env.WAREHOUSE_NUMBER || "100",
  complement: process.env.WAREHOUSE_COMPLEMENT || "",
  district: process.env.WAREHOUSE_DISTRICT || "Sé",
  city: process.env.WAREHOUSE_CITY || "São Paulo",
  state_abbr: process.env.WAREHOUSE_STATE || "SP",
  country_id: "BR"
};

function generateValidCPF() {
  const rand = (n) => Math.floor(Math.random() * n);
  const mod = (d, n) => d % n < 2 ? 0 : n - d % n;
  const d = Array.from({ length: 9 }, () => rand(9));
  d.push(mod(d.reduce((s, v, i) => s + v * (10 - i), 0), 11));
  d.push(mod(d.reduce((s, v, i) => s + v * (11 - i), 0), 11));
  return d.join("");
}

async function addToMelhorEnvioCart(params) {
  if (!MELHOR_ENVIO_TOKEN) throw new Error("MELHOR_ENVIO_TOKEN is required");
  const body = {
    service: params.melhorEnvioServiceId,
    from: { ...WAREHOUSE_FROM, postal_code: params.fromCep || WAREHOUSE_CEP },
    to: {
      name: params.toName, phone: params.toPhone || "11999999999",
      email: params.toEmail || "cliente@kairos.com.br",
      document: params.toDocument || generateValidCPF(),
      postal_code: params.toCep, address: params.toAddress, number: params.toNumber,
      complement: params.toComplement || "", district: params.toNeighborhood,
      city: params.toCity, state_abbr: params.toState, country_id: "BR"
    },
    products: params.products,
    package: { weight: params.pkg.weightKg, width: params.pkg.widthCm, height: params.pkg.heightCm, length: params.pkg.lengthCm },
    options: { insurance_value: params.insuredValue },
    volumes: [{ weight: params.pkg.weightKg, width: params.pkg.widthCm, height: params.pkg.heightCm, length: params.pkg.lengthCm }]
  };
  const response = await fetch(`${BASE_URL}/api/v2/me/cart`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`, "User-Agent": "Kairos Grafica (contato@kairos.com.br)" },
    body: JSON.stringify(body)
  });
  if (!response.ok) { const text = await response.text(); throw new Error(`Melhor Envio cart error ${response.status}: ${text}`); }
  const data = await response.json();
  return { cartItemId: data.id };
}

async function checkoutShipment(cartItemIds) {
  if (!MELHOR_ENVIO_TOKEN) throw new Error("MELHOR_ENVIO_TOKEN is required");
  const response = await fetch(`${BASE_URL}/api/v2/me/shipment/checkout`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`, "User-Agent": "Kairos Grafica (contato@kairos.com.br)" },
    body: JSON.stringify({ orders: cartItemIds })
  });
  if (!response.ok) { const text = await response.text(); throw new Error(`Melhor Envio checkout error ${response.status}: ${text}`); }
}

async function generateLabel(cartItemIds) {
  if (!MELHOR_ENVIO_TOKEN) throw new Error("MELHOR_ENVIO_TOKEN is required");
  const response = await fetch(`${BASE_URL}/api/v2/me/shipment/generate`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`, "User-Agent": "Kairos Grafica (contato@kairos.com.br)" },
    body: JSON.stringify({ orders: cartItemIds })
  });
  if (!response.ok) { const text = await response.text(); throw new Error(`Melhor Envio generate error ${response.status}: ${text}`); }
}

async function getLabelUrl(cartItemIds) {
  if (!MELHOR_ENVIO_TOKEN) throw new Error("MELHOR_ENVIO_TOKEN is required");
  const response = await fetch(`${BASE_URL}/api/v2/me/shipment/print`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`, "User-Agent": "Kairos Grafica (contato@kairos.com.br)" },
    body: JSON.stringify({ orders: cartItemIds })
  });
  if (!response.ok) { const text = await response.text(); throw new Error(`Melhor Envio print error ${response.status}: ${text}`); }
  const data = await response.json();
  return { url: data.url };
}

async function getTrackingInfo(trackingCode) {
  if (!MELHOR_ENVIO_TOKEN || !trackingCode) return [];
  try {
    const response = await fetch(`${BASE_URL}/api/v2/me/shipment/tracking`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`, "User-Agent": "Kairos Grafica (contato@kairos.com.br)" },
      body: JSON.stringify({ orders: [trackingCode] })
    });
    if (!response.ok) return [];
    const data = await response.json();
    const trackingData = data[trackingCode]?.tracking;
    if (!Array.isArray(trackingData)) return [];
    return trackingData.map((evt) => ({
      status: evt.status || "", date: evt.date || evt.datetime || "",
      location: evt.locale || evt.location || "", description: evt.description || evt.message || ""
    }));
  } catch { return []; }
}

async function autoGenerateLabel(orderId) {
  try {
    const order = await storage.getOrder(orderId);
    if (!order) return;
    const addr = order.shippingAddress;
    const serviceId = order.shippingServiceId;
    if (!addr || !serviceId || !MELHOR_ENVIO_TOKEN) return;
    const items = await storage.getOrderItems(orderId);
    const cartLikeItems = items.map((item) => ({
      id: item.id, sessionId: "", productId: item.productId, variantId: item.variantId,
      quantity: item.quantity, unitPrice: item.unitPrice, specifications: item.specifications,
      artFileUrl: item.artFileUrl, createdAt: new Date()
    }));
    const pkg = await calculatePackage(cartLikeItems);
    const insuredValue = parseFloat(order.total);
    const customer = await storage.getCustomer(order.customerId);
    const recipientName = customer?.name || "Destinatário";
    const meProducts = items.map((item) => ({
      name: item.productName, quantity: item.quantity,
      unitary_value: parseFloat(item.unitPrice) * item.quantity > 0 ? parseFloat((parseFloat(item.subtotal) / item.quantity).toFixed(2)) : 1
    }));
    const { cartItemId } = await addToMelhorEnvioCart({
      melhorEnvioServiceId: serviceId, fromCep: WAREHOUSE_CEP,
      toCep: addr.cep, toName: recipientName, toPhone: customer?.phone,
      toEmail: customer?.email, toAddress: addr.street, toNumber: addr.number,
      toComplement: addr.complement, toNeighborhood: addr.neighborhood,
      toCity: addr.city, toState: addr.state, pkg, insuredValue, orderId, products: meProducts
    });
    await checkoutShipment([cartItemId]);
    await generateLabel([cartItemId]);
    const { url } = await getLabelUrl([cartItemId]);
    await storage.updateShippingLabel(orderId, url);
    await storage.updateOrderStatus(orderId, "production");
  } catch (err) {
    console.error(`[AutoLabel] Failed for order ${orderId}:`, err?.message || err);
  }
}

// ── Middleware: admin-auth ────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
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
  storage.getAdminUser(payload.adminUserId).then((admin) => {
    if (!admin || !admin.active) {
      res.status(401).json({ message: "Conta administrativa desativada" });
      return;
    }
    req.adminUserId = payload.adminUserId;
    req.adminRole = payload.role;
    next();
  }).catch(() => res.status(500).json({ message: "Erro ao verificar credenciais" }));
}

function requireRole(...roles) {
  return (req, res, next) => {
    requireAdmin(req, res, () => {
      if (req.adminRole === "admin" || roles.includes(req.adminRole)) { next(); return; }
      res.status(403).json({ message: "Permissão insuficiente" });
    });
  };
}

// ── Middleware: rate-limit ────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { message: "Muitas tentativas. Tente novamente em 15 minutos." }, statusCode: 429
});
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { message: "Muitas tentativas de checkout. Tente novamente em 15 minutos." }, statusCode: 429
});

// ── Services: email ───────────────────────────────────────────────────────────

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM || "Kairós Gráfica <noreply@kairos.com.br>";

function layout(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
<tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#111;padding:24px 32px;text-align:center;">
<span style="color:#d4af37;font-size:24px;font-weight:700;">KAIRÓS</span>
<span style="color:#999;font-size:14px;display:block;">GRÁFICA</span>
</td></tr>
<tr><td style="padding:32px;">${body}</td></tr>
<tr><td style="background:#fafafa;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
<p style="margin:0;color:#999;font-size:12px;">Kairós Gráfica — Qualidade que marca.</p>
</td></tr></table></td></tr></table></body></html>`;
}

async function sendEmail(to, subject, html) {
  if (!resend) { console.warn("[Email] RESEND_API_KEY not configured — skipping email"); return; }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error(`[Email] Failed to send "${subject}" to ${to}:`, err?.message || err);
  }
}

function sendOrderConfirmedEmail(to, orderId, total) {
  const shortId = orderId.slice(0, 8).toUpperCase();
  return sendEmail(to, `Pagamento confirmado — Pedido #${shortId}`, layout("Pagamento Confirmado",
    `<h2>Pagamento confirmado!</h2><p>Pedido <strong>#${shortId}</strong> confirmado.</p>
<p>Total: <strong>R$ ${total}</strong></p>`));
}
function sendOrderInProductionEmail(to, orderId) {
  const shortId = orderId.slice(0, 8).toUpperCase();
  return sendEmail(to, `Pedido #${shortId} em produção`, layout("Em Produção",
    `<h2>Seu pedido está em produção!</h2><p>O pedido <strong>#${shortId}</strong> entrou na fase de produção.</p>`));
}
function sendOrderShippedEmail(to, orderId, trackingCode) {
  const shortId = orderId.slice(0, 8).toUpperCase();
  return sendEmail(to, `Pedido #${shortId} enviado — Rastreio: ${trackingCode}`, layout("Pedido Enviado",
    `<h2>Seu pedido foi enviado!</h2><p>Rastreio: <strong>${trackingCode}</strong></p>`));
}
function sendOrderDeliveredEmail(to, orderId) {
  const shortId = orderId.slice(0, 8).toUpperCase();
  return sendEmail(to, `Pedido #${shortId} entregue`, layout("Pedido Entregue",
    `<h2>Pedido entregue!</h2><p>O pedido <strong>#${shortId}</strong> foi entregue com sucesso.</p>`));
}
function sendOrderCancelledEmail(to, orderId) {
  const shortId = orderId.slice(0, 8).toUpperCase();
  return sendEmail(to, `Pedido #${shortId} cancelado`, layout("Pedido Cancelado",
    `<h2>Pedido cancelado</h2><p>O pedido <strong>#${shortId}</strong> foi cancelado.</p>`));
}
function sendWelcomeEmail(to, name) {
  const firstName = name.split(" ")[0];
  return sendEmail(to, `Bem-vindo à Kairós Gráfica, ${firstName}!`, layout("Bem-vindo",
    `<h2>Bem-vindo à Kairós Gráfica!</h2><p>Olá <strong>${firstName}</strong>, sua conta foi criada com sucesso.</p>`));
}

async function triggerOrderEmail(orderId, newStatus, trackingCode) {
  try {
    const order = await storage.getOrder(orderId);
    if (!order) return;
    const customer = await storage.getCustomer(order.customerId);
    if (!customer?.email) return;
    const to = customer.email;
    switch (newStatus) {
      case "confirmed": await sendOrderConfirmedEmail(to, orderId, order.total); break;
      case "production": await sendOrderInProductionEmail(to, orderId); break;
      case "shipped": if (trackingCode) await sendOrderShippedEmail(to, orderId, trackingCode); break;
      case "delivered": await sendOrderDeliveredEmail(to, orderId); break;
      case "cancelled": await sendOrderCancelledEmail(to, orderId); break;
    }
  } catch (err) {
    console.error(`[Email] triggerOrderEmail failed for order ${orderId}:`, err?.message || err);
  }
}

// ── Services: storage-client ──────────────────────────────────────────────────

let supabase = null;

function getClient() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) { console.warn("[Storage] SUPABASE_URL or SUPABASE_SERVICE_KEY not configured"); return null; }
  supabase = createClient(url, key);
  return supabase;
}

const BUCKET = "art-files";
const PRODUCT_BUCKET = "product-images";

async function uploadArtFile({ buffer, mimetype, originalname, orderId, orderItemId }) {
  const client = getClient();
  if (!client) throw new Error("Supabase Storage não configurado");
  const timestamp = Date.now();
  const safeName = originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `orders/${orderId}/${orderItemId}/${timestamp}-${safeName}`;
  const { error } = await client.storage.from(BUCKET).upload(path, buffer, { contentType: mimetype, upsert: false });
  if (error) throw new Error(`Upload falhou: ${error.message}`);
  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadProductImage(buffer, filename, mimetype) {
  const client = getClient();
  if (!client) throw new Error("Supabase Storage não configurado");
  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${timestamp}-${safeName}`;
  const { error } = await client.storage.from(PRODUCT_BUCKET).upload(path, buffer, { contentType: mimetype, upsert: false });
  if (error) throw new Error(`Upload falhou: ${error.message}`);
  const { data } = client.storage.from(PRODUCT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function getSignedArtUrl(filePath) {
  const client = getClient();
  if (!client) throw new Error("Supabase Storage não configurado");
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(filePath, 3600);
  if (error || !data?.signedUrl) throw new Error(`Signed URL falhou: ${error?.message}`);
  return data.signedUrl;
}

// ── Routes: Admin ─────────────────────────────────────────────────────────────

function str(val) {
  if (Array.isArray(val)) return val[0] || "";
  return val || "";
}

const adminLoginSchema = external_exports.object({ email: external_exports.string().email(), password: external_exports.string().min(1) });
const createAdminUserSchema = external_exports.object({
  email: external_exports.string().email(), displayName: external_exports.string().min(2),
  password: external_exports.string().min(6),
  role: external_exports.enum(["admin", "operador", "financeiro"]).default("operador"),
  active: external_exports.boolean().default(true)
});
const updateAdminUserSchema = external_exports.object({
  email: external_exports.string().email().optional(), displayName: external_exports.string().min(2).optional(),
  password: external_exports.string().min(6).optional(),
  role: external_exports.enum(["admin", "operador", "financeiro"]).optional(),
  active: external_exports.boolean().optional()
});
const createCategorySchema = external_exports.object({
  name: external_exports.string().min(1), slug: external_exports.string().min(1),
  description: external_exports.string().optional(), imageUrl: external_exports.string().optional(),
  icon: external_exports.string().optional(), sortOrder: external_exports.number().int().default(0),
  active: external_exports.boolean().default(true)
});
const updateCategorySchema = createCategorySchema.partial();
const createProductSchema = external_exports.object({
  categoryId: external_exports.string().min(1), name: external_exports.string().min(1),
  slug: external_exports.string().min(1), description: external_exports.string().optional(),
  basePrice: external_exports.string().regex(/^\d+(\.\d{1,2})?$/),
  minQuantity: external_exports.number().int().positive().default(100),
  quantitySteps: external_exports.array(external_exports.number()).optional(),
  imageUrl: external_exports.string().optional(), active: external_exports.boolean().default(true),
  seoTitle: external_exports.string().optional(), seoDescription: external_exports.string().optional()
});
const updateProductSchema = createProductSchema.partial();
const createVariantSchema = external_exports.object({
  productId: external_exports.string().min(1), paperTypeId: external_exports.string().min(1),
  finishingId: external_exports.string().optional().nullable(),
  widthMm: external_exports.number().int().positive(), heightMm: external_exports.number().int().positive(),
  colorsFront: external_exports.number().int().default(4), colorsBack: external_exports.number().int().default(0),
  sku: external_exports.string().min(1), priceTable: external_exports.record(external_exports.number()).optional()
});
const updateVariantSchema = createVariantSchema.partial();
const createPaperTypeSchema = external_exports.object({
  name: external_exports.string().min(1), weightGsm: external_exports.number().int().positive(),
  finish: external_exports.string().min(1),
  costPerSheet: external_exports.string().transform((v) => v.replace(",", ".")).pipe(external_exports.string().regex(/^\d+(\.\d{1,4})?$/)),
  active: external_exports.boolean().default(true), sortOrder: external_exports.number().int().default(0)
});
const updatePaperTypeSchema = createPaperTypeSchema.partial();
const createFinishingSchema = external_exports.object({
  name: external_exports.string().min(1), type: external_exports.string().min(1),
  priceModifier: external_exports.string().regex(/^\d+(\.\d{1,4})?$/).default("0"),
  multiplier: external_exports.string().regex(/^\d+(\.\d{1,4})?$/).default("1.0"),
  active: external_exports.boolean().default(true), sortOrder: external_exports.number().int().default(0)
});
const updateFinishingSchema = createFinishingSchema.partial();
const createPriceRuleSchema = external_exports.object({
  productId: external_exports.string().min(1), minQty: external_exports.number().int().positive(),
  maxQty: external_exports.number().int().positive(),
  pricePerUnit: external_exports.string().regex(/^\d+(\.\d{1,4})?$/),
  setupFee: external_exports.string().regex(/^\d+(\.\d{1,2})?$/).default("0")
});
const updatePriceRuleSchema = createPriceRuleSchema.partial();
const updateOrderStatusSchema = external_exports.object({
  status: external_exports.enum(["pending", "confirmed", "production", "shipped", "delivered", "cancelled"])
});
const createCouponSchema = external_exports.object({
  code: external_exports.string().min(1), discountType: external_exports.enum(["percentage", "fixed"]),
  discountValue: external_exports.string().regex(/^\d+(\.\d{1,2})?$/),
  minOrderAmount: external_exports.string().regex(/^\d+(\.\d{1,2})?$/).default("0"),
  maxUses: external_exports.number().int().positive().nullable().optional(),
  validFrom: external_exports.string().min(1), validTo: external_exports.string().min(1),
  active: external_exports.boolean().default(true)
});
const updateCouponSchema = createCouponSchema.partial();
const updateTrackingSchema = external_exports.object({ trackingCode: external_exports.string().min(1) });
const updateArtStatusSchema = external_exports.object({
  orderItemId: external_exports.string().min(1),
  artStatus: external_exports.enum(["pending", "uploaded", "approved", "rejected"])
});
const createOrderNoteSchema = external_exports.object({ content: external_exports.string().min(1).max(5000) });
const updateSettingsSchema = external_exports.object({ settings: external_exports.record(external_exports.string()) });
const createEstrategiaPlanSchema = external_exports.object({
  name: external_exports.string().min(1), price: external_exports.string().min(1),
  period: external_exports.string().default("/mês"), recommended: external_exports.boolean().default(false),
  features: external_exports.array(external_exports.string()).default([]),
  whatsappMessage: external_exports.string().default(""),
  sortOrder: external_exports.number().int().default(0), active: external_exports.boolean().default(true)
});
const updateEstrategiaPlanSchema = createEstrategiaPlanSchema.partial();
const createEstrategiaStepSchema = external_exports.object({
  number: external_exports.string().min(1), title: external_exports.string().min(1),
  description: external_exports.string().min(1), sortOrder: external_exports.number().int().default(0)
});
const updateEstrategiaStepSchema = createEstrategiaStepSchema.partial();

async function audit(adminUserId, action, entityType, entityId, details, ip) {
  try {
    await storage.createAuditLog({ adminUserId, action, entityType, entityId: entityId ?? null, details: details ?? null, ipAddress: ip ?? null });
  } catch (e) {
    console.error("[Audit] Failed to create audit log:", e);
  }
}

function registerAdminRoutes(app) {
  const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) cb(null, true);
      else cb(new Error("Apenas imagens são permitidas"));
    }
  });

  app.post("/api/admin/upload-image", requireAdmin, imageUpload.single("file"), async (req, res) => {
    if (!req.file) { res.status(400).json({ message: "Nenhuma imagem enviada" }); return; }
    try {
      const url = await uploadProductImage(req.file.buffer, req.file.originalname, req.file.mimetype);
      res.json({ url });
    } catch (err) {
      res.status(500).json({ message: err?.message || "Erro ao fazer upload da imagem" });
    }
  });

  app.post("/api/admin/auth/login", authLimiter, validate(adminLoginSchema), async (req, res) => {
    const { email, password } = req.body;
    const admin = await storage.getAdminUserByEmail(email);
    if (!admin || !admin.active) { res.status(401).json({ message: "Credenciais inválidas" }); return; }
    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) { res.status(401).json({ message: "Credenciais inválidas" }); return; }
    await storage.updateAdminUserLastLogin(admin.id);
    const token = generateAdminToken(admin.id, admin.role);
    res.json({ token, user: { id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role } });
  });

  app.get("/api/admin/dashboard/kpis", requireAdmin, async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const prevTo = new Date(dateFrom);
    const prevFrom = new Date(dateFrom);
    prevFrom.setDate(prevFrom.getDate() - days);
    const [current, previous] = await Promise.all([storage.getDashboardKPIs(dateFrom, dateTo), storage.getDashboardKPIs(prevFrom, prevTo)]);
    const calcChange = (curr, prev) => prev === 0 ? 0 : Math.round((curr - prev) / prev * 100);
    res.json({
      revenue: current.revenue, revenueChange: calcChange(current.revenue, previous.revenue),
      orders: current.orders, ordersChange: calcChange(current.orders, previous.orders),
      newCustomers: current.newCustomers, newCustomersChange: calcChange(current.newCustomers, previous.newCustomers),
      avgTicket: current.avgTicket, avgTicketChange: calcChange(current.avgTicket, previous.avgTicket)
    });
  });

  app.get("/api/admin/dashboard/revenue-chart", requireAdmin, async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const data = await storage.getRevenueByPeriod(dateFrom, dateTo, days > 90 ? "month" : "day");
    res.json(data);
  });

  app.get("/api/admin/dashboard/order-status-distribution", requireAdmin, async (_req, res) => {
    res.json(await storage.getOrderStatusDistribution());
  });

  app.get("/api/admin/dashboard/top-products", requireAdmin, async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 5;
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    res.json(await storage.getTopProducts(limit, dateFrom, dateTo));
  });

  app.get("/api/admin/dashboard/recent-orders", requireAdmin, async (_req, res) => {
    const { data } = await storage.getOrdersPaginated({ page: 1, pageSize: 5 });
    res.json(data);
  });

  app.get("/api/admin/orders", requireRole("admin", "operador", "financeiro"), async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const { status, paymentStatus, customerId, search } = req.query;
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : undefined;
    const result = await storage.getOrdersPaginated({ page, pageSize, status, paymentStatus, customerId, dateFrom, dateTo, search });
    res.json({ ...result, page, pageSize, totalPages: Math.ceil(result.total / pageSize) });
  });

  app.get("/api/admin/orders/:id", requireRole("admin", "operador", "financeiro"), async (req, res) => {
    const order = await storage.getOrder(str(req.params.id));
    if (!order) { res.status(404).json({ message: "Pedido não encontrado" }); return; }
    const items = await storage.getOrderItems(order.id);
    const customer = await storage.getCustomer(order.customerId);
    res.json({ ...order, items, customer: customer ? { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } : undefined });
  });

  app.patch("/api/admin/orders/:id/status", requireRole("admin", "operador"), validate(updateOrderStatusSchema), async (req, res) => {
    const orderId = str(req.params.id);
    const order = await storage.getOrder(orderId);
    if (!order) { res.status(404).json({ message: "Pedido não encontrado" }); return; }
    const updated = await storage.updateOrderStatus(orderId, req.body.status);
    if (!updated) { res.status(404).json({ message: "Pedido não encontrado" }); return; }
    if (req.body.status === "confirmed" && order.paymentMethod === "whatsapp_pix" && order.paymentStatus === "pending") {
      await storage.updatePaymentStatus(orderId, "approved");
    }
    await audit(req.adminUserId, "update_status", "order", orderId, { status: req.body.status });
    triggerOrderEmail(orderId, req.body.status).catch(() => {});
    if (["confirmed", "production"].includes(req.body.status) && !updated.shippingLabelUrl) {
      autoGenerateLabel(orderId).catch(() => {});
    }
    if (req.body.status === "cancelled" && order.paymentStatus === "approved" && order.paymentExternalId) {
      createRefund(order.paymentExternalId)
        .then(() => storage.updatePaymentStatus(orderId, "refunded"))
        .catch((err) => console.error(`[Refund] Failed for order ${orderId}:`, err?.message || err));
    }
    res.json(updated);
  });

  app.patch("/api/admin/orders/:id/tracking", requireRole("admin", "operador"), validate(updateTrackingSchema), async (req, res) => {
    const updated = await storage.updateOrderTracking(str(req.params.id), req.body.trackingCode);
    if (!updated) { res.status(404).json({ message: "Pedido não encontrado" }); return; }
    await audit(req.adminUserId, "update_tracking", "order", str(req.params.id), { trackingCode: req.body.trackingCode });
    if (updated.status === "shipped") triggerOrderEmail(str(req.params.id), "shipped", req.body.trackingCode).catch(() => {});
    res.json(updated);
  });

  app.patch("/api/admin/orders/:id/art-status", requireRole("admin", "operador"), validate(updateArtStatusSchema), async (req, res) => {
    const { orderItemId, artStatus } = req.body;
    const item = await storage.updateOrderItemArt(orderItemId, "", artStatus);
    if (!item) { res.status(404).json({ message: "Item não encontrado" }); return; }
    await audit(req.adminUserId, "update_art_status", "order_item", orderItemId, { artStatus });
    res.json(item);
  });

  app.get("/api/admin/orders/:id/art/:itemId/download", requireRole("admin", "operador"), async (req, res) => {
    const orderItem = await storage.getOrderItemById(str(req.params.itemId));
    if (!orderItem || orderItem.orderId !== str(req.params.id)) { res.status(404).json({ message: "Item não encontrado" }); return; }
    if (!orderItem.artFileUrl) { res.status(404).json({ message: "Nenhum arquivo de arte enviado" }); return; }
    try {
      const url = new URL(orderItem.artFileUrl);
      const pathMatch = url.pathname.match(/\/object\/public\/art-files\/(.+)$/);
      if (!pathMatch) { res.redirect(orderItem.artFileUrl); return; }
      const signedUrl = await getSignedArtUrl(pathMatch[1]);
      res.redirect(signedUrl);
    } catch {
      res.redirect(orderItem.artFileUrl);
    }
  });

  app.post("/api/admin/orders/:id/generate-label", requireRole("admin", "operador"), async (req, res) => {
    const order = await storage.getOrder(str(req.params.id));
    if (!order) { res.status(404).json({ message: "Pedido não encontrado" }); return; }
    const { melhorEnvioServiceId, address } = req.body;
    if (!melhorEnvioServiceId || !address) { res.status(400).json({ message: "melhorEnvioServiceId e address são obrigatórios" }); return; }
    try {
      const orderItemsList = await storage.getOrderItems(order.id);
      const fakeCartItems = orderItemsList.map((oi) => ({
        id: oi.id, sessionId: "", productId: oi.productId, variantId: oi.variantId,
        quantity: oi.quantity, unitPrice: oi.unitPrice, specifications: oi.specifications,
        artFileUrl: oi.artFileUrl, createdAt: new Date()
      }));
      const pkg = await calculatePackage(fakeCartItems);
      const insuredValue = parseFloat(order.total);
      const meProducts = orderItemsList.map((oi) => ({ name: oi.productName, quantity: oi.quantity, unitary_value: parseFloat(oi.subtotal) / oi.quantity || 1 }));
      const { cartItemId } = await addToMelhorEnvioCart({
        melhorEnvioServiceId, fromCep: process.env.WAREHOUSE_CEP || "01001000",
        toCep: address.cep, toName: address.name || "Cliente", toAddress: address.street,
        toNumber: address.number, toComplement: address.complement,
        toNeighborhood: address.neighborhood, toCity: address.city, toState: address.state,
        pkg, insuredValue, orderId: order.id, products: meProducts
      });
      await checkoutShipment([cartItemId]);
      await generateLabel([cartItemId]);
      const { url } = await getLabelUrl([cartItemId]);
      await audit(req.adminUserId, "generate_label", "order", str(req.params.id), { labelUrl: url });
      res.json({ labelUrl: url, cartItemId });
    } catch (err) {
      res.status(500).json({ message: err?.message || "Erro ao gerar etiqueta" });
    }
  });

  app.get("/api/admin/orders/:id/notes", requireRole("admin", "operador", "financeiro"), async (req, res) => {
    res.json(await storage.getOrderNotes(str(req.params.id)));
  });

  app.post("/api/admin/orders/:id/notes", requireRole("admin", "operador"), validate(createOrderNoteSchema), async (req, res) => {
    const admin = await storage.getAdminUser(req.adminUserId);
    const note = await storage.createOrderNote({ orderId: str(req.params.id), authorName: admin?.displayName || "Admin", content: req.body.content });
    res.status(201).json(note);
  });

  // Categories
  app.get("/api/admin/categories", requireRole("admin"), async (_req, res) => {
    const cats = await storage.getAllCategoriesAdmin();
    const result = await Promise.all(cats.map(async (cat) => ({ ...cat, productCount: (await storage.getProductsByCategory(cat.id)).length })));
    res.json(result);
  });
  app.post("/api/admin/categories", requireRole("admin"), validate(createCategorySchema), async (req, res) => {
    const cat = await storage.createCategory(req.body);
    await audit(req.adminUserId, "create", "category", cat.id);
    res.status(201).json(cat);
  });
  app.patch("/api/admin/categories/:id", requireRole("admin"), validate(updateCategorySchema), async (req, res) => {
    const cat = await storage.updateCategory(str(req.params.id), req.body);
    if (!cat) { res.status(404).json({ message: "Categoria não encontrada" }); return; }
    await audit(req.adminUserId, "update", "category", str(req.params.id));
    res.json(cat);
  });
  app.delete("/api/admin/categories/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteCategory(str(req.params.id));
    await audit(req.adminUserId, "delete", "category", str(req.params.id));
    res.status(204).send();
  });

  // Products
  app.get("/api/admin/products", requireRole("admin"), async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const result = await storage.getAllProductsAdmin({ page, pageSize, categoryId: req.query.categoryId, search: req.query.search });
    res.json({ ...result, page, pageSize, totalPages: Math.ceil(result.total / pageSize) });
  });
  app.get("/api/admin/products/:id", requireRole("admin"), async (req, res) => {
    const product = await storage.getProductById(str(req.params.id));
    if (!product) { res.status(404).json({ message: "Produto não encontrado" }); return; }
    const variants = await storage.getProductVariants(product.id);
    const rules = await storage.getPriceRules(product.id);
    res.json({ ...product, variants, priceRules: rules });
  });
  app.post("/api/admin/products", requireRole("admin"), validate(createProductSchema), async (req, res) => {
    const product = await storage.createProduct(req.body);
    await audit(req.adminUserId, "create", "product", product.id);
    res.status(201).json(product);
  });
  app.patch("/api/admin/products/:id", requireRole("admin"), validate(updateProductSchema), async (req, res) => {
    const product = await storage.updateProduct(str(req.params.id), req.body);
    if (!product) { res.status(404).json({ message: "Produto não encontrado" }); return; }
    await audit(req.adminUserId, "update", "product", str(req.params.id));
    res.json(product);
  });
  app.delete("/api/admin/products/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteProduct(str(req.params.id));
    await audit(req.adminUserId, "delete", "product", str(req.params.id));
    res.status(204).send();
  });

  // Variants
  app.post("/api/admin/products/:id/variants", requireRole("admin"), validate(createVariantSchema), async (req, res) => {
    const variant = await storage.createProductVariant({ ...req.body, productId: str(req.params.id) });
    await audit(req.adminUserId, "create", "variant", variant.id);
    res.status(201).json(variant);
  });
  app.patch("/api/admin/variants/:id", requireRole("admin"), validate(updateVariantSchema), async (req, res) => {
    const variant = await storage.updateProductVariant(str(req.params.id), req.body);
    if (!variant) { res.status(404).json({ message: "Variante não encontrada" }); return; }
    await audit(req.adminUserId, "update", "variant", str(req.params.id));
    res.json(variant);
  });
  app.delete("/api/admin/variants/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteProductVariant(str(req.params.id));
    await audit(req.adminUserId, "delete", "variant", str(req.params.id));
    res.status(204).send();
  });

  // Price Rules
  app.post("/api/admin/products/:id/price-rules", requireRole("admin"), validate(createPriceRuleSchema), async (req, res) => {
    const rule = await storage.createPriceRule({ ...req.body, productId: str(req.params.id) });
    await audit(req.adminUserId, "create", "price_rule", rule.id);
    res.status(201).json(rule);
  });
  app.patch("/api/admin/price-rules/:id", requireRole("admin"), validate(updatePriceRuleSchema), async (req, res) => {
    const rule = await storage.updatePriceRule(str(req.params.id), req.body);
    if (!rule) { res.status(404).json({ message: "Regra não encontrada" }); return; }
    await audit(req.adminUserId, "update", "price_rule", str(req.params.id));
    res.json(rule);
  });
  app.delete("/api/admin/price-rules/:id", requireRole("admin"), async (req, res) => {
    await storage.deletePriceRule(str(req.params.id));
    await audit(req.adminUserId, "delete", "price_rule", str(req.params.id));
    res.status(204).send();
  });

  // Paper Types
  app.get("/api/admin/paper-types", requireRole("admin"), async (_req, res) => res.json(await storage.getAllPaperTypesAdmin()));
  app.post("/api/admin/paper-types", requireRole("admin"), validate(createPaperTypeSchema), async (req, res) => {
    const paper = await storage.createPaperType(req.body);
    await audit(req.adminUserId, "create", "paper_type", paper.id);
    res.status(201).json(paper);
  });
  app.patch("/api/admin/paper-types/:id", requireRole("admin"), validate(updatePaperTypeSchema), async (req, res) => {
    const paper = await storage.updatePaperType(str(req.params.id), req.body);
    if (!paper) { res.status(404).json({ message: "Tipo de papel não encontrado" }); return; }
    await audit(req.adminUserId, "update", "paper_type", str(req.params.id));
    res.json(paper);
  });
  app.delete("/api/admin/paper-types/:id", requireRole("admin"), async (req, res) => {
    await storage.deletePaperType(str(req.params.id));
    await audit(req.adminUserId, "delete", "paper_type", str(req.params.id));
    res.status(204).send();
  });

  // Finishings
  app.get("/api/admin/finishings", requireRole("admin"), async (_req, res) => res.json(await storage.getAllFinishingsAdmin()));
  app.post("/api/admin/finishings", requireRole("admin"), validate(createFinishingSchema), async (req, res) => {
    const finishing = await storage.createFinishing(req.body);
    await audit(req.adminUserId, "create", "finishing", finishing.id);
    res.status(201).json(finishing);
  });
  app.patch("/api/admin/finishings/:id", requireRole("admin"), validate(updateFinishingSchema), async (req, res) => {
    const finishing = await storage.updateFinishing(str(req.params.id), req.body);
    if (!finishing) { res.status(404).json({ message: "Acabamento não encontrado" }); return; }
    await audit(req.adminUserId, "update", "finishing", str(req.params.id));
    res.json(finishing);
  });
  app.delete("/api/admin/finishings/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteFinishing(str(req.params.id));
    await audit(req.adminUserId, "delete", "finishing", str(req.params.id));
    res.status(204).send();
  });

  // Customers (admin)
  app.get("/api/admin/customers", requireRole("admin", "operador", "financeiro"), async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const result = await storage.getAllCustomers({ page, pageSize, search: req.query.search });
    res.json({ ...result, page, pageSize, totalPages: Math.ceil(result.total / pageSize) });
  });
  app.get("/api/admin/customers/:id", requireRole("admin", "operador", "financeiro"), async (req, res) => {
    const customer = await storage.getCustomer(str(req.params.id));
    if (!customer) { res.status(404).json({ message: "Cliente não encontrado" }); return; }
    res.json({ ...customer, orders: await storage.getOrdersByCustomer(customer.id) });
  });

  // Reports
  app.get("/api/admin/reports/revenue", requireRole("admin", "financeiro"), async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const dateTo = new Date(), dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    res.json(await storage.getRevenueByPeriod(dateFrom, dateTo, days > 90 ? "month" : "day"));
  });
  app.get("/api/admin/reports/payment-status", requireRole("admin", "financeiro"), async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const dateTo = new Date(), dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    res.json(await storage.getPaymentStatusBreakdown(dateFrom, dateTo));
  });
  app.get("/api/admin/reports/top-products", requireRole("admin", "financeiro"), async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 10;
    const dateTo = new Date(), dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    res.json(await storage.getTopProducts(limit, dateFrom, dateTo));
  });
  app.get("/api/admin/reports/monthly-comparison", requireRole("admin", "financeiro"), async (req, res) => {
    res.json(await storage.getMonthlyComparison(parseInt(req.query.months) || 12));
  });
  app.get("/api/admin/reports/export/csv", requireRole("admin", "financeiro"), async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const dateTo = new Date(), dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const { data: ordersList } = await storage.getOrdersPaginated({ page: 1, pageSize: 10000, dateFrom, dateTo });
    const csvRows = ["ID,Data,Status,Pagamento,Subtotal,Frete,Total"];
    for (const order of ordersList) {
      csvRows.push([order.id, new Date(order.createdAt).toISOString().split("T")[0], order.status, order.paymentStatus, order.subtotal, order.shippingCost, order.total].join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=relatorio-${dateFrom.toISOString().split("T")[0]}-${dateTo.toISOString().split("T")[0]}.csv`);
    res.send(csvRows.join("\n"));
  });

  // Coupons
  app.get("/api/admin/coupons", requireRole("admin"), async (_req, res) => res.json(await storage.getAllCoupons()));
  app.post("/api/admin/coupons", requireRole("admin"), validate(createCouponSchema), async (req, res) => {
    const coupon = await storage.createCoupon({ ...req.body, validFrom: new Date(req.body.validFrom), validTo: new Date(req.body.validTo), maxUses: req.body.maxUses ?? null });
    await audit(req.adminUserId, "create", "coupon", coupon.id);
    res.status(201).json(coupon);
  });
  app.patch("/api/admin/coupons/:id", requireRole("admin"), validate(updateCouponSchema), async (req, res) => {
    const data = { ...req.body };
    if (data.validFrom) data.validFrom = new Date(data.validFrom);
    if (data.validTo) data.validTo = new Date(data.validTo);
    const coupon = await storage.updateCoupon(str(req.params.id), data);
    if (!coupon) { res.status(404).json({ message: "Cupom não encontrado" }); return; }
    await audit(req.adminUserId, "update", "coupon", str(req.params.id));
    res.json(coupon);
  });
  app.delete("/api/admin/coupons/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteCoupon(str(req.params.id));
    await audit(req.adminUserId, "delete", "coupon", str(req.params.id));
    res.status(204).send();
  });

  // Estratégia
  app.get("/api/admin/estrategia/plans", requireRole("admin"), async (_req, res) => res.json(await storage.getAllEstrategiaPlans()));
  app.post("/api/admin/estrategia/plans", requireRole("admin"), validate(createEstrategiaPlanSchema), async (req, res) => {
    const plan = await storage.createEstrategiaPlan(req.body);
    await audit(req.adminUserId, "create", "estrategia_plan", plan.id);
    res.status(201).json(plan);
  });
  app.patch("/api/admin/estrategia/plans/:id", requireRole("admin"), validate(updateEstrategiaPlanSchema), async (req, res) => {
    const plan = await storage.updateEstrategiaPlan(str(req.params.id), req.body);
    if (!plan) { res.status(404).json({ message: "Plano não encontrado" }); return; }
    await audit(req.adminUserId, "update", "estrategia_plan", str(req.params.id));
    res.json(plan);
  });
  app.delete("/api/admin/estrategia/plans/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteEstrategiaPlan(str(req.params.id));
    await audit(req.adminUserId, "delete", "estrategia_plan", str(req.params.id));
    res.status(204).send();
  });
  app.get("/api/admin/estrategia/steps", requireRole("admin"), async (_req, res) => res.json(await storage.getAllEstrategiaSteps()));
  app.post("/api/admin/estrategia/steps", requireRole("admin"), validate(createEstrategiaStepSchema), async (req, res) => {
    const step = await storage.createEstrategiaStep(req.body);
    await audit(req.adminUserId, "create", "estrategia_step", step.id);
    res.status(201).json(step);
  });
  app.patch("/api/admin/estrategia/steps/:id", requireRole("admin"), validate(updateEstrategiaStepSchema), async (req, res) => {
    const step = await storage.updateEstrategiaStep(str(req.params.id), req.body);
    if (!step) { res.status(404).json({ message: "Passo não encontrado" }); return; }
    await audit(req.adminUserId, "update", "estrategia_step", str(req.params.id));
    res.json(step);
  });
  app.delete("/api/admin/estrategia/steps/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteEstrategiaStep(str(req.params.id));
    await audit(req.adminUserId, "delete", "estrategia_step", str(req.params.id));
    res.status(204).send();
  });

  // Settings
  app.get("/api/admin/settings", requireRole("admin"), async (_req, res) => {
    const settings = await storage.getAllSettings();
    const map = {};
    settings.forEach((s) => { map[s.key] = s.value; });
    res.json(map);
  });
  app.patch("/api/admin/settings", requireRole("admin"), validate(updateSettingsSchema), async (req, res) => {
    for (const [key, value] of Object.entries(req.body.settings)) await storage.setSetting(key, value);
    await audit(req.adminUserId, "update", "settings", undefined, { keys: Object.keys(req.body.settings) });
    res.json({ success: true });
  });
  app.get("/api/admin/settings/api-status", requireRole("admin"), async (_req, res) => {
    const statuses = [];
    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) {
      statuses.push({ service: "MercadoPago", connected: false, details: "MP_ACCESS_TOKEN não configurado" });
    } else {
      try {
        const mpRes = await fetch("https://api.mercadopago.com/v1/payment_methods", { headers: { Authorization: `Bearer ${mpToken}` } });
        statuses.push({ service: "MercadoPago", connected: mpRes.ok, details: mpRes.ok ? `Conectado (${mpRes.status})` : `Erro ${mpRes.status}` });
      } catch (err) {
        statuses.push({ service: "MercadoPago", connected: false, details: `Falha na conexão: ${err?.message || err}` });
      }
    }
    const meToken = process.env.MELHOR_ENVIO_TOKEN;
    if (!meToken) {
      statuses.push({ service: "Melhor Envio", connected: false, details: "MELHOR_ENVIO_TOKEN não configurado" });
    } else {
      const isSandbox = process.env.MELHOR_ENVIO_SANDBOX !== "false";
      const meBaseUrl = isSandbox ? "https://sandbox.melhorenvio.com.br" : "https://api.melhorenvio.com.br";
      try {
        const meRes = await fetch(`${meBaseUrl}/api/v2/me`, { headers: { Authorization: `Bearer ${meToken}`, Accept: "application/json", "User-Agent": "Kairos Grafica (contato@kairos.com.br)" } });
        const env = isSandbox ? "Sandbox" : "Produção";
        statuses.push({ service: "Melhor Envio", connected: meRes.ok, details: meRes.ok ? `${env} — OK (${meRes.status})` : `${env} — Erro ${meRes.status}` });
      } catch (err) {
        statuses.push({ service: "Melhor Envio", connected: false, details: `Falha na conexão: ${err?.message || err}` });
      }
    }
    try { await storage.getCategories(); statuses.push({ service: "Database", connected: true, details: "Conectado" }); }
    catch { statuses.push({ service: "Database", connected: false, details: "Erro de conexão" }); }
    res.json(statuses);
  });

  // Admin Users
  app.get("/api/admin/users", requireRole("admin"), async (_req, res) => {
    const admins = await storage.getAdminUsers();
    res.json(admins.map(({ passwordHash, ...rest }) => rest));
  });
  app.post("/api/admin/users", requireRole("admin"), validate(createAdminUserSchema), async (req, res) => {
    const { password, ...rest } = req.body;
    if (await storage.getAdminUserByEmail(rest.email)) { res.status(409).json({ message: "E-mail já cadastrado" }); return; }
    const passwordHash = await hashPassword(password);
    const admin = await storage.createAdminUser({ ...rest, passwordHash });
    await audit(req.adminUserId, "create", "admin_user", admin.id);
    const { passwordHash: _, ...safe } = admin;
    res.status(201).json(safe);
  });
  app.patch("/api/admin/users/:id", requireRole("admin"), validate(updateAdminUserSchema), async (req, res) => {
    if (str(req.params.id) === req.adminUserId && req.body.role) { res.status(400).json({ message: "Não é possível alterar o próprio role" }); return; }
    const updateData = { ...req.body };
    if (updateData.password) { updateData.passwordHash = await hashPassword(updateData.password); delete updateData.password; }
    const admin = await storage.updateAdminUser(str(req.params.id), updateData);
    if (!admin) { res.status(404).json({ message: "Admin não encontrado" }); return; }
    await audit(req.adminUserId, "update", "admin_user", str(req.params.id));
    const { passwordHash: _, ...safe } = admin;
    res.json(safe);
  });
  app.delete("/api/admin/users/:id", requireRole("admin"), async (req, res) => {
    if (str(req.params.id) === req.adminUserId) { res.status(400).json({ message: "Não é possível deletar a si mesmo" }); return; }
    await storage.deleteAdminUser(str(req.params.id));
    await audit(req.adminUserId, "delete", "admin_user", str(req.params.id));
    res.status(204).send();
  });

  // Audit log
  app.get("/api/admin/audit-log", requireRole("admin"), async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const result = await storage.getAuditLogs({ page, pageSize, adminUserId: req.query.adminUserId, entityType: req.query.entityType });
    res.json({ ...result, page, pageSize, totalPages: Math.ceil(result.total / pageSize) });
  });
}

// ── Routes: Main ──────────────────────────────────────────────────────────────

async function registerRoutes(httpServer, app) {
  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  const siteUrl = (process.env.SITE_URL || "https://kairos.com.br").trim().replace(/\s+/g, "");

  app.get("/sitemap.xml", async (_req, res) => {
    const cats = await storage.getCategories();
    const allProducts = [];
    for (const cat of cats) {
      const prods = await storage.getProductsByCategory(cat.id);
      for (const p of prods) allProducts.push({ slug: p.slug });
    }
    const urls = [
      `<url><loc>${siteUrl}/grafica</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
      ...cats.map((c) => `<url><loc>${siteUrl}/grafica/${c.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
      ...allProducts.map((p) => `<url><loc>${siteUrl}/grafica/produto/${p.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`)
    ];
    res.header("Content-Type", "application/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
  });

  app.get("/robots.txt", (_req, res) => {
    res.header("Content-Type", "text/plain");
    res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
  });

  app.get("/api/config/payment-mode", (_req, res) => {
    res.json({ mode: process.env.PAYMENT_MODE || "mercadopago", whatsappNumber: process.env.WHATSAPP_NUMBER || "" });
  });

  app.get("/api/estrategia/plans", async (_req, res) => res.json(await storage.getActiveEstrategiaPlans()));
  app.get("/api/estrategia/steps", async (_req, res) => res.json(await storage.getAllEstrategiaSteps()));

  // Catalog
  app.get("/api/grafica/categories", async (_req, res) => {
    const cats = await storage.getCategories();
    const result = await Promise.all(cats.map(async (cat) => ({ ...cat, productCount: await storage.getProductCountByCategory(cat.id) })));
    res.json(result);
  });

  app.get("/api/grafica/categories/:slug", async (req, res) => {
    const category = await storage.getCategoryBySlug(req.params.slug);
    if (!category) { res.status(404).json({ message: "Categoria não encontrada" }); return; }
    const prods = await storage.getProductsByCategory(category.id);
    const productsWithPrice = await Promise.all(prods.map(async (product) => {
      const rules = await storage.getPriceRules(product.id);
      const prices = rules.map((r) => parseFloat(r.pricePerUnit));
      const priceRange = prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: parseFloat(product.basePrice), max: parseFloat(product.basePrice) };
      return { ...product, priceRange };
    }));
    res.json({ ...category, products: productsWithPrice });
  });

  app.get("/api/grafica/products/:slug", async (req, res) => {
    const product = await storage.getProductBySlug(req.params.slug);
    if (!product) { res.status(404).json({ message: "Produto não encontrado" }); return; }
    const category = await storage.getCategoryById(product.categoryId);
    if (!category) { res.status(404).json({ message: "Categoria do produto não encontrada" }); return; }
    const variants = await storage.getProductVariants(product.id);
    const priceRules = await storage.getPriceRules(product.id);
    const allPapers = await storage.getPaperTypes();
    const allFinishings = await storage.getFinishings();
    const usedPaperIds = new Set(variants.map((v) => v.paperTypeId));
    const usedFinishingIds = new Set(variants.map((v) => v.finishingId).filter(Boolean));
    const prices = priceRules.map((r) => parseFloat(r.pricePerUnit));
    const priceRange = prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: parseFloat(product.basePrice), max: parseFloat(product.basePrice) };
    res.json({ ...product, category, variants, availablePapers: allPapers.filter((p) => usedPaperIds.has(p.id)), availableFinishings: allFinishings.filter((f) => usedFinishingIds.has(f.id)), priceRange, priceRules });
  });

  app.get("/api/grafica/search", async (req, res) => {
    const q = (req.query.q || "").trim();
    if (q.length < 2) { res.json([]); return; }
    const prods = await storage.searchProducts(q);
    const enriched = await Promise.all(prods.map(async (product) => {
      const rules = await storage.getPriceRules(product.id);
      const prices = rules.map((r) => parseFloat(r.pricePerUnit));
      const priceRange = prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: parseFloat(product.basePrice), max: parseFloat(product.basePrice) };
      return { ...product, priceRange };
    }));
    res.json(enriched);
  });

  app.get("/api/grafica/paper-types", async (_req, res) => res.json(await storage.getPaperTypes()));
  app.get("/api/grafica/finishings", async (_req, res) => res.json(await storage.getFinishings()));

  // Cart
  app.get("/api/grafica/cart/:sessionId", async (req, res) => {
    const items = await storage.getCartItems(req.params.sessionId);
    const uniqueProductIds = [...new Set(items.map((i) => i.productId))];
    const productResults = await Promise.all(uniqueProductIds.map((id) => storage.getProductById(id)));
    const productMap = new Map(productResults.filter(Boolean).map((p) => [p.id, p]));
    const itemsWithProducts = await Promise.all(items.map(async (item) => {
      const product = productMap.get(item.productId);
      let variant;
      if (product && item.variantId) {
        const variants = await storage.getProductVariants(product.id);
        variant = variants.find((v) => v.id === item.variantId);
      }
      return { ...item, product, variant };
    }));
    const validItems = itemsWithProducts.filter((i) => i.product);
    const subtotal = validItems.reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0);
    res.json({ items: validItems, itemCount: validItems.reduce((sum, item) => sum + item.quantity, 0), subtotal });
  });
  app.post("/api/grafica/cart", validate(addCartItemSchema), async (req, res) => {
    res.status(201).json(await storage.addCartItem(req.body));
  });
  app.patch("/api/grafica/cart/:id", validate(updateCartItemSchema), async (req, res) => {
    const updated = await storage.updateCartItem(req.params.id, req.body.quantity);
    if (!updated) { res.status(404).json({ message: "Item não encontrado" }); return; }
    res.json(updated);
  });
  app.delete("/api/grafica/cart/item/:id", async (req, res) => { await storage.removeCartItem(req.params.id); res.status(204).send(); });
  app.delete("/api/grafica/cart/session/:sessionId", async (req, res) => { await storage.clearCart(req.params.sessionId); res.status(204).send(); });

  // Orders (public)
  app.post("/api/grafica/orders", async (req, res) => {
    const order = await storage.createOrder(req.body);
    if (req.body.items) await storage.addOrderItems(req.body.items.map((item) => ({ ...item, orderId: order.id })));
    res.status(201).json(order);
  });
  app.get("/api/grafica/orders/:id", async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) { res.status(404).json({ message: "Pedido não encontrado" }); return; }
    res.json({ ...order, items: await storage.getOrderItems(order.id) });
  });
  app.patch("/api/grafica/orders/:id/status", validate(updateStatusSchema), async (req, res) => {
    const updated = await storage.updateOrderStatus(req.params.id, req.body.status);
    if (!updated) { res.status(404).json({ message: "Pedido não encontrado" }); return; }
    res.json(updated);
  });

  // Shipping
  app.post("/api/grafica/shipping/quote", async (req, res) => {
    const { cep, sessionId } = req.body;
    const cleanCep = (cep || "").replace(/\D/g, "");
    if (cleanCep.length !== 8) { res.status(400).json({ message: "CEP inválido" }); return; }
    try {
      const items = sessionId ? await storage.getCartItems(sessionId) : [];
      res.json(await calculateShipping({ destinationCep: cleanCep, items }));
    } catch {
      res.json(MOCK_QUOTES);
    }
  });

  app.get("/api/grafica/address/:cep", async (req, res) => {
    const cep = req.params.cep.replace(/\D/g, "");
    if (cep.length !== 8) { res.status(400).json({ message: "CEP inválido" }); return; }
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data.erro) { res.status(404).json({ message: "CEP não encontrado" }); return; }
      res.json({ cep: data.cep, street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf, complement: data.complemento });
    } catch {
      res.status(500).json({ message: "Erro ao consultar CEP" });
    }
  });

  // Auth
  app.post("/api/grafica/auth/register", authLimiter, validate(registerSchema), async (req, res) => {
    const { name, email, phone, password } = req.body;
    if (await storage.getCustomerByEmail(email)) { res.status(409).json({ message: "E-mail já cadastrado" }); return; }
    const passwordHash = await hashPassword(password);
    const customer = await storage.createCustomer({ name, email, phone: phone || null, passwordHash });
    const token = generateToken(customer.id);
    sendWelcomeEmail(email, name).catch(() => {});
    res.status(201).json({ token, customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } });
  });
  app.post("/api/grafica/auth/login", authLimiter, validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    const customer = await storage.getCustomerByEmail(email);
    if (!customer || !await verifyPassword(password, customer.passwordHash)) {
      res.status(401).json({ message: "E-mail ou senha incorretos" }); return;
    }
    res.json({ token: generateToken(customer.id), customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } });
  });
  app.get("/api/grafica/auth/me", requireAuth, async (req, res) => {
    const customer = await storage.getCustomer(req.customerId);
    if (!customer) { res.status(404).json({ message: "Cliente não encontrado" }); return; }
    res.json({ id: customer.id, name: customer.name, email: customer.email, phone: customer.phone });
  });

  // Checkout
  app.post("/api/grafica/checkout", checkoutLimiter, requireAuth, validate(checkoutSchema), async (req, res) => {
    const { sessionId, customerName, customerEmail, customerPhone, address, shippingOption, notes, couponCode } = req.body;
    const cartItemsList = await storage.getCartItems(sessionId);
    if (cartItemsList.length === 0) { res.status(400).json({ message: "Carrinho vazio" }); return; }
    const subtotal = cartItemsList.reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0);
    const shippingCost = shippingOption?.price || 0;
    let discountAmount = 0, appliedCouponCode = null;
    if (couponCode) {
      const coupon = await storage.getCouponByCode(couponCode);
      if (coupon && coupon.active) {
        const now = new Date();
        const inPeriod = now >= new Date(coupon.validFrom) && now <= new Date(coupon.validTo);
        const hasUses = coupon.maxUses === null || coupon.currentUses < coupon.maxUses;
        const meetsMin = subtotal >= parseFloat(coupon.minOrderAmount);
        if (inPeriod && hasUses && meetsMin) {
          discountAmount = coupon.discountType === "percentage"
            ? subtotal * parseFloat(coupon.discountValue) / 100
            : parseFloat(coupon.discountValue);
          discountAmount = Math.min(discountAmount, subtotal);
          appliedCouponCode = coupon.code;
          await storage.incrementCouponUses(coupon.id);
        }
      }
    }
    const total = subtotal - discountAmount + shippingCost;
    const orderNotes = [notes, `__sessionId:${sessionId}`].filter(Boolean).join("\n");
    const order = await storage.createOrder({
      customerId: req.customerId, status: "pending", addressId: null,
      subtotal: subtotal.toFixed(2), shippingCost: shippingCost.toFixed(2), total: total.toFixed(2),
      paymentMethod: (process.env.PAYMENT_MODE || "mercadopago") === "whatsapp" ? "whatsapp_pix" : "mercadopago",
      paymentStatus: "pending", paymentExternalId: null, mpPreferenceId: null,
      shippingTrackingCode: null, shippingAddress: address || null,
      shippingServiceId: shippingOption?.melhorEnvioId ?? null, shippingLabelUrl: null,
      couponCode: appliedCouponCode, discountAmount: discountAmount.toFixed(2), notes: orderNotes
    });
    const uniqueProductIds = [...new Set(cartItemsList.map((i) => i.productId))];
    const productResults = await Promise.all(uniqueProductIds.map((id) => storage.getProductById(id)));
    const prodMap = new Map(productResults.filter(Boolean).map((p) => [p.id, p.name]));
    const orderItemsData = cartItemsList.map((item) => ({
      orderId: order.id, productId: item.productId, variantId: item.variantId,
      productName: prodMap.get(item.productId) ?? "Produto Gráfica",
      quantity: item.quantity, unitPrice: item.unitPrice,
      subtotal: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
      specifications: item.specifications, artFileUrl: item.artFileUrl,
      artStatus: item.artFileUrl ? "uploaded" : "pending"
    }));
    await storage.addOrderItems(orderItemsData);
    const paymentMode = process.env.PAYMENT_MODE || "mercadopago";
    if (paymentMode === "whatsapp") {
      await storage.clearCart(sessionId);
      res.status(201).json({
        paymentMode: "whatsapp", orderId: order.id, customerName: customerName || "Cliente",
        itemsSummary: orderItemsData.map((item) => ({ name: item.productName, quantity: item.quantity, unitPrice: parseFloat(item.unitPrice), subtotal: parseFloat(item.subtotal) })),
        subtotal, discountAmount, couponCode: appliedCouponCode, shippingCost,
        shippingService: shippingOption ? `${shippingOption.carrier} - ${shippingOption.service}` : null,
        total, address: address || null, whatsappNumber: process.env.WHATSAPP_NUMBER || ""
      });
      return;
    }
    try {
      const preferenceItems = cartItemsList.map((item) => ({ id: item.productId, title: prodMap.get(item.productId) ?? "Produto Gráfica", quantity: item.quantity, unit_price: parseFloat(parseFloat(item.unitPrice).toFixed(2)) }));
      const preference = await createPreference({ orderId: order.id, items: preferenceItems, shippingCost, discountAmount, payer: { name: customerName || "Cliente", email: customerEmail || "guest@kairos.com.br", phone: customerPhone } });
      await storage.updatePaymentStatus(order.id, "pending", preference.preferenceId);
      res.status(201).json({ orderId: order.id, total, preferenceId: preference.preferenceId, initPoint: preference.initPoint, sandboxInitPoint: preference.sandboxInitPoint });
    } catch (err) {
      console.error("[Checkout] MercadoPago preference creation failed:", err?.message);
      res.status(201).json({ orderId: order.id, total, paymentError: "Erro ao criar preferência de pagamento. Tente novamente." });
    }
  });

  // Art upload
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ALLOWED_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/tiff", "application/postscript", "application/illustrator", "application/eps"];
      if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
      else cb(new Error("Formato não suportado. Envie PDF, JPG, PNG, TIFF, AI ou EPS."));
    }
  });
  app.post("/api/grafica/upload", requireAuth, upload.single("file"), async (req, res) => {
    const { orderItemId } = req.body;
    if (!req.file) { res.status(400).json({ message: "Nenhum arquivo enviado" }); return; }
    if (!orderItemId) { res.status(400).json({ message: "orderItemId é obrigatório" }); return; }
    const orderItem = await storage.getOrderItemById(orderItemId);
    if (!orderItem) { res.status(404).json({ message: "Item do pedido não encontrado" }); return; }
    try {
      const url = await uploadArtFile({ buffer: req.file.buffer, mimetype: req.file.mimetype, originalname: req.file.originalname, orderId: orderItem.orderId, orderItemId });
      await storage.updateOrderItemArt(orderItemId, url, "uploaded");
      res.json({ uploadUrl: url, fileId: randomUUID(), status: "accepted" });
    } catch (err) {
      res.status(500).json({ message: err?.message || "Erro ao fazer upload do arquivo" });
    }
  });

  // Coupons (public)
  app.post("/api/grafica/coupons/validate", async (req, res) => {
    const { code, subtotal } = req.body;
    if (!code || typeof code !== "string") { res.status(400).json({ valid: false, message: "Código do cupom é obrigatório" }); return; }
    const coupon = await storage.getCouponByCode(code);
    if (!coupon || !coupon.active) { res.json({ valid: false, message: "Cupom não encontrado ou inativo" }); return; }
    const now = new Date();
    if (now < new Date(coupon.validFrom) || now > new Date(coupon.validTo)) { res.json({ valid: false, message: "Cupom fora do período de validade" }); return; }
    if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) { res.json({ valid: false, message: "Cupom atingiu o limite de usos" }); return; }
    const orderSubtotal = parseFloat(subtotal) || 0;
    if (orderSubtotal < parseFloat(coupon.minOrderAmount)) { res.json({ valid: false, message: `Pedido mínimo de R$ ${parseFloat(coupon.minOrderAmount).toFixed(2)}` }); return; }
    let discountAmount = coupon.discountType === "percentage" ? orderSubtotal * parseFloat(coupon.discountValue) / 100 : parseFloat(coupon.discountValue);
    discountAmount = Math.min(discountAmount, orderSubtotal);
    res.json({
      valid: true, code: coupon.code, discountType: coupon.discountType,
      discountValue: coupon.discountValue, discountAmount: parseFloat(discountAmount.toFixed(2)),
      message: coupon.discountType === "percentage" ? `${parseFloat(coupon.discountValue)}% de desconto aplicado!` : `Desconto de R$ ${parseFloat(coupon.discountValue).toFixed(2)} aplicado!`
    });
  });

  // Tracking
  app.get("/api/grafica/orders/:id/tracking", async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) { res.status(404).json({ message: "Pedido não encontrado" }); return; }
    if (!order.shippingTrackingCode) { res.json({ trackingCode: null, events: [] }); return; }
    res.json({ trackingCode: order.shippingTrackingCode, events: await getTrackingInfo(order.shippingTrackingCode) });
  });

  // Cancel order
  app.post("/api/grafica/orders/:id/cancel", requireAuth, async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) { res.status(404).json({ message: "Pedido não encontrado" }); return; }
    if (order.customerId !== req.customerId) { res.status(403).json({ message: "Acesso negado" }); return; }
    if (!["pending", "confirmed"].includes(order.status)) { res.status(400).json({ message: "Este pedido não pode mais ser cancelado" }); return; }
    await storage.updateOrderStatus(order.id, "cancelled");
    if (order.paymentStatus === "approved" && order.paymentExternalId) {
      createRefund(order.paymentExternalId).then(() => storage.updatePaymentStatus(order.id, "refunded")).catch(() => {});
    }
    triggerOrderEmail(order.id, "cancelled").catch(() => {});
    res.json({ message: "Pedido cancelado com sucesso" });
  });

  // Account
  app.get("/api/grafica/account/orders", requireAuth, async (req, res) => res.json(await storage.getOrdersByCustomer(req.customerId)));
  app.get("/api/grafica/account/addresses", requireAuth, async (req, res) => res.json(await storage.getAddressesByCustomer(req.customerId)));
  app.post("/api/grafica/account/addresses", requireAuth, validate(createAddressSchema), async (req, res) => {
    res.status(201).json(await storage.createAddress({ ...req.body, customerId: req.customerId }));
  });
  app.patch("/api/grafica/account/addresses/:id", requireAuth, validate(updateAddressSchema), async (req, res) => {
    const existing = await storage.getAddress(req.params.id);
    if (!existing || existing.customerId !== req.customerId) { res.status(404).json({ message: "Endereço não encontrado" }); return; }
    res.json(await storage.updateAddress(req.params.id, req.body));
  });
  app.delete("/api/grafica/account/addresses/:id", requireAuth, async (req, res) => {
    const existing = await storage.getAddress(req.params.id);
    if (!existing || existing.customerId !== req.customerId) { res.status(404).json({ message: "Endereço não encontrado" }); return; }
    await storage.deleteAddress(req.params.id);
    res.status(204).send();
  });
  app.patch("/api/grafica/account/profile", requireAuth, validate(updateProfileSchema), async (req, res) => {
    const updated = await storage.updateCustomer(req.customerId, req.body);
    if (!updated) { res.status(404).json({ message: "Cliente não encontrado" }); return; }
    res.json({ id: updated.id, name: updated.name, email: updated.email, phone: updated.phone });
  });
  app.post("/api/grafica/account/change-password", requireAuth, validate(changePasswordSchema), async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const customer = await storage.getCustomer(req.customerId);
    if (!customer) { res.status(404).json({ message: "Cliente não encontrado" }); return; }
    if (!await verifyPassword(currentPassword, customer.passwordHash)) { res.status(400).json({ message: "Senha atual incorreta" }); return; }
    await storage.updateCustomer(req.customerId, { passwordHash: await hashPassword(newPassword) });
    res.json({ message: "Senha alterada com sucesso" });
  });

  registerAdminRoutes(app);

  // MercadoPago webhook
  app.post("/api/webhooks/mercadopago", async (req, res) => {
    try {
      const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
      if (webhookSecret) {
        const xSignature = req.headers["x-signature"];
        const xRequestId = req.headers["x-request-id"];
        const dataId = req.query["data.id"] || req.body?.data?.id || "";
        if (!xSignature) { res.status(401).json({ message: "Assinatura ausente" }); return; }
        const parts = Object.fromEntries(xSignature.split(",").map((p) => { const [k, ...v] = p.split("="); return [k.trim(), v.join("=")]; }));
        const ts = parts["ts"], v1 = parts["v1"];
        if (!ts || !v1) { res.status(401).json({ message: "Formato de assinatura inválido" }); return; }
        const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
        const computed = createHmac("sha256", webhookSecret).update(template).digest("hex");
        try {
          if (!timingSafeEqual(Buffer.from(computed), Buffer.from(v1))) { res.status(401).json({ message: "Assinatura inválida" }); return; }
        } catch { res.status(401).json({ message: "Assinatura inválida" }); return; }
      }
      const { type, data } = req.body;
      if (type !== "payment" || !data?.id) { res.status(200).json({ received: true, processed: false }); return; }
      const paymentId = String(data.id);
      const payment = await getPayment(paymentId);
      if (!payment.externalReference) { res.status(200).json({ received: true, processed: false }); return; }
      const orderId = payment.externalReference;
      const order = await storage.getOrder(orderId);
      if (!order) { res.status(200).json({ received: true, processed: false }); return; }
      const { orderStatus, paymentStatus } = mapPaymentStatus(payment.status);
      if (order.paymentStatus !== paymentStatus) {
        await storage.updatePaymentStatus(orderId, paymentStatus, paymentId);
        await storage.updateOrderStatus(orderId, orderStatus);
        if (paymentStatus === "approved" && order.notes) {
          const sessionMatch = order.notes.match(/__sessionId:(\S+)/);
          if (sessionMatch) await storage.clearCart(sessionMatch[1]);
        }
        if (paymentStatus === "approved") autoGenerateLabel(orderId).catch(() => {});
        triggerOrderEmail(orderId, orderStatus).catch(() => {});
      }
      res.status(200).json({ received: true, processed: true });
    } catch (err) {
      console.error("[Webhook] Error:", err?.message || err);
      res.status(200).json({ received: true, error: true });
    }
  });

  app.get("/api/grafica/orders/:id/payment-status", async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) { res.status(404).json({ message: "Pedido não encontrado" }); return; }
    res.json({ orderId: order.id, status: order.status, paymentStatus: order.paymentStatus, paymentMethod: order.paymentMethod });
  });

  app.post("/api/grafica/orders/:id/verify-payment", async (req, res) => {
    const orderId = req.params.id;
    const { paymentId } = req.body;
    const order = await storage.getOrder(orderId);
    if (!order) { res.status(404).json({ message: "Pedido não encontrado" }); return; }
    if (order.paymentStatus === "approved") { res.json({ orderId: order.id, status: order.status, paymentStatus: order.paymentStatus, updated: false }); return; }
    if (!paymentId) { res.json({ orderId: order.id, status: order.status, paymentStatus: order.paymentStatus, updated: false }); return; }
    try {
      const payment = await getPayment(String(paymentId));
      if (payment.externalReference !== orderId) { res.status(400).json({ message: "Pagamento não corresponde ao pedido" }); return; }
      const { orderStatus, paymentStatus } = mapPaymentStatus(payment.status);
      if (order.paymentStatus !== paymentStatus) {
        await storage.updatePaymentStatus(orderId, paymentStatus, String(paymentId));
        await storage.updateOrderStatus(orderId, orderStatus);
        if (paymentStatus === "approved" && order.notes) {
          const sessionMatch = order.notes.match(/__sessionId:(\S+)/);
          if (sessionMatch) await storage.clearCart(sessionMatch[1]);
        }
        if (paymentStatus === "approved") autoGenerateLabel(orderId).catch(() => {});
        triggerOrderEmail(orderId, orderStatus).catch(() => {});
      }
      res.json({ orderId: order.id, status: orderStatus, paymentStatus, updated: order.paymentStatus !== paymentStatus });
    } catch (err) {
      res.json({ orderId: order.id, status: order.status, paymentStatus: order.paymentStatus, updated: false, error: "Não foi possível verificar o pagamento" });
    }
  });

  return httpServer;
}

// ── Entry point ───────────────────────────────────────────────────────────────

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({
  limit: "1mb",
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

const httpServer = createServer(app);
await registerRoutes(httpServer, app);

app.use((err, _req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Internal Server Error:", err);
  if (res.headersSent) return next(err);
  return res.status(status).json({ message });
});

export default app;
