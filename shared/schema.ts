import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ── Admin Users (completely separate from customers) ──
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("admin"), // "admin" | "operador" | "financeiro"
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({ id: true, lastLoginAt: true, createdAt: true });
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

// ── Audit Log ──
export const auditLog = pgTable("audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull().references(() => adminUsers.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details").$type<Record<string, any>>(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLog.$inferSelect;

// ── Store Settings ──
export const storeSettings = pgTable("store_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type StoreSetting = typeof storeSettings.$inferSelect;

// ── Gráfica: Categories ──
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// ── Gráfica: Products ──
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  minQuantity: integer("min_quantity").notNull().default(100),
  quantitySteps: jsonb("quantity_steps").$type<number[]>().default([500, 1000, 2000, 5000]),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// ── Gráfica: Paper Types ──
export const paperTypes = pgTable("paper_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  weightGsm: integer("weight_gsm").notNull(),
  finish: text("finish").notNull(), // "fosco" | "brilho" | "natural"
  costPerSheet: numeric("cost_per_sheet", { precision: 10, scale: 4 }).notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertPaperTypeSchema = createInsertSchema(paperTypes).omit({ id: true });
export type InsertPaperType = z.infer<typeof insertPaperTypeSchema>;
export type PaperType = typeof paperTypes.$inferSelect;

// ── Gráfica: Finishings ──
export const finishings = pgTable("finishings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // "laminacao" | "verniz" | "refile" | "corte_especial" | "dobra"
  priceModifier: numeric("price_modifier", { precision: 10, scale: 4 }).notNull().default("0"),
  multiplier: numeric("multiplier", { precision: 6, scale: 4 }).notNull().default("1.0"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertFinishingSchema = createInsertSchema(finishings).omit({ id: true });
export type InsertFinishing = z.infer<typeof insertFinishingSchema>;
export type Finishing = typeof finishings.$inferSelect;

// ── Gráfica: Product Variants ──
export const productVariants = pgTable("product_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  paperTypeId: varchar("paper_type_id").notNull().references(() => paperTypes.id),
  finishingId: varchar("finishing_id").references(() => finishings.id),
  widthMm: integer("width_mm").notNull(),
  heightMm: integer("height_mm").notNull(),
  colorsFront: integer("colors_front").notNull().default(4),
  colorsBack: integer("colors_back").notNull().default(0),
  sku: text("sku").notNull().unique(),
  priceTable: jsonb("price_table").$type<Record<string, number>>(),
});

export const insertProductVariantSchema = createInsertSchema(productVariants).omit({ id: true });
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type ProductVariant = typeof productVariants.$inferSelect;

// ── Gráfica: Price Rules ──
export const priceRules = pgTable("price_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  minQty: integer("min_qty").notNull(),
  maxQty: integer("max_qty").notNull(),
  pricePerUnit: numeric("price_per_unit", { precision: 10, scale: 4 }).notNull(),
  setupFee: numeric("setup_fee", { precision: 10, scale: 2 }).notNull().default("0"),
});

export const insertPriceRuleSchema = createInsertSchema(priceRules).omit({ id: true });
export type InsertPriceRule = z.infer<typeof insertPriceRuleSchema>;
export type PriceRule = typeof priceRules.$inferSelect;

// ── Gráfica: Customers ──
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// ── Gráfica: Addresses ──
export const addresses = pgTable("addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  label: text("label").notNull().default("Principal"),
  cep: text("cep").notNull(),
  street: text("street").notNull(),
  number: text("number").notNull(),
  complement: text("complement"),
  neighborhood: text("neighborhood").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
});

export const insertAddressSchema = createInsertSchema(addresses).omit({ id: true });
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type Address = typeof addresses.$inferSelect;

// ── Gráfica: Orders ──
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  status: text("status").notNull().default("pending"),
  addressId: varchar("address_id"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentExternalId: text("payment_external_id"),
  mpPreferenceId: text("mp_preference_id"),
  shippingTrackingCode: text("shipping_tracking_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// ── Gráfica: Order Items ──
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  variantId: varchar("variant_id"),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 4 }).notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  specifications: jsonb("specifications").$type<Record<string, string>>(),
  artFileUrl: text("art_file_url"),
  artStatus: text("art_status").default("pending"),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// ── Gráfica: Cart Items ──
export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  productId: varchar("product_id").notNull().references(() => products.id),
  variantId: varchar("variant_id"),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 4 }).notNull(),
  specifications: jsonb("specifications").$type<Record<string, string>>(),
  artFileUrl: text("art_file_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({ id: true, createdAt: true });
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type CartItem = typeof cartItems.$inferSelect;
