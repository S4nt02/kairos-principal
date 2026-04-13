import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, numeric, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
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
  mioloTypeId: varchar("miolo_type_id"), // FK to paper_types — set after paperTypes declaration
  stockQuantity: integer("stock_quantity").notNull().default(0),
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
  stockQuantity: integer("stock_quantity").notNull().default(0),
});

export const insertFinishingSchema = createInsertSchema(finishings).omit({ id: true });
export type InsertFinishing = z.infer<typeof insertFinishingSchema>;
export type Finishing = typeof finishings.$inferSelect;

// ── Gráfica: Product Finishings (vínculo produto ↔ acabamento) ──
export const productFinishings = pgTable("product_finishings", {
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  finishingId: varchar("finishing_id").notNull().references(() => finishings.id, { onDelete: "cascade" }),
});

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
  shippingAddress: jsonb("shipping_address").$type<{ cep: string; street: string; number: string; complement?: string; neighborhood: string; city: string; state: string }>(),
  shippingServiceId: integer("shipping_service_id"),
  shippingLabelUrl: text("shipping_label_url"),
  couponCode: text("coupon_code"),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
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

// ── Gráfica: Coupons ──
export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull(), // "percentage" | "fixed"
  discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: numeric("min_order_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  maxUses: integer("max_uses"), // null = unlimited
  currentUses: integer("current_uses").notNull().default(0),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, currentUses: true, createdAt: true });
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;

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

// ── Order Notes (admin internal notes) ──
export const orderNotes = pgTable("order_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrderNoteSchema = createInsertSchema(orderNotes).omit({ id: true, createdAt: true });
export type InsertOrderNote = z.infer<typeof insertOrderNoteSchema>;
export type OrderNote = typeof orderNotes.$inferSelect;

// ── Estratégia de Conteúdo: Plans ──
export const estrategiaPlans = pgTable("estrategia_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  price: text("price").notNull(),
  period: text("period").notNull().default("/mês"),
  recommended: boolean("recommended").notNull().default(false),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  whatsappMessage: text("whatsapp_message").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEstrategiaPlanSchema = createInsertSchema(estrategiaPlans).omit({ id: true, createdAt: true });
export type InsertEstrategiaPlan = z.infer<typeof insertEstrategiaPlanSchema>;
export type EstrategiaPlan = typeof estrategiaPlans.$inferSelect;

// ── Estratégia de Conteúdo: Steps ──
export const estrategiaSteps = pgTable("estrategia_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEstrategiaStepSchema = createInsertSchema(estrategiaSteps).omit({ id: true, createdAt: true });
export type InsertEstrategiaStep = z.infer<typeof insertEstrategiaStepSchema>;
export type EstrategiaStep = typeof estrategiaSteps.$inferSelect;

// ── Gráfica: Wire-o Options ──
export const wireoOptions = pgTable("wireo_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  colorHex: text("color_hex"),
  sizeMm: integer("size_mm"),
  priceModifier: numeric("price_modifier", { precision: 10, scale: 2 }).notNull().default("0"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWireoOptionSchema = createInsertSchema(wireoOptions).omit({ id: true, createdAt: true });
export type InsertWireoOption = z.infer<typeof insertWireoOptionSchema>;
export type WireoOption = typeof wireoOptions.$inferSelect;

// ── Gráfica: Addon Categories (Adereços — categorias) ──
export const addonCategories = pgTable("addon_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAddonCategorySchema = createInsertSchema(addonCategories).omit({ id: true, createdAt: true });
export type InsertAddonCategory = z.infer<typeof insertAddonCategorySchema>;
export type AddonCategory = typeof addonCategories.$inferSelect;

// ── Gráfica: Addon Items (Adereços — itens) ──
export const addonItems = pgTable("addon_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  addonCategoryId: varchar("addon_category_id").notNull().references(() => addonCategories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  priceModifier: numeric("price_modifier", { precision: 10, scale: 2 }).notNull().default("0"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAddonItemSchema = createInsertSchema(addonItems).omit({ id: true, createdAt: true });
export type InsertAddonItem = z.infer<typeof insertAddonItemSchema>;
export type AddonItem = typeof addonItems.$inferSelect;

// ── Gráfica: Product Addon Items (vínculo produto ↔ item específico de adereço) ──
export const productAddonItems = pgTable("product_addon_items", {
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  addonItemId: varchar("addon_item_id").notNull().references(() => addonItems.id, { onDelete: "cascade" }),
});

// ── Gráfica: Product Addon Categories (vínculo produto ↔ categoria de adereço) ──
export const productAddonCategories = pgTable("product_addon_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  addonCategoryId: varchar("addon_category_id").notNull().references(() => addonCategories.id, { onDelete: "cascade" }),
  maxAllowed: integer("max_allowed").notNull().default(1),
});

export const insertProductAddonCategorySchema = createInsertSchema(productAddonCategories).omit({ id: true });
export type InsertProductAddonCategory = z.infer<typeof insertProductAddonCategorySchema>;
export type ProductAddonCategory = typeof productAddonCategories.$inferSelect;

// ── Gráfica: Product Discounts (Promoções) ──
export const productDiscounts = pgTable("product_discounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  discountType: text("discount_type").notNull(), // "percentage" | "fixed"
  discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProductDiscountSchema = createInsertSchema(productDiscounts).omit({ id: true, createdAt: true });
export type InsertProductDiscount = z.infer<typeof insertProductDiscountSchema>;
export type ProductDiscount = typeof productDiscounts.$inferSelect;

// ── Gráfica: Stock Reservations (Reservas de 10 minutos) ──
export const stockReservations = pgTable("stock_reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cartSessionId: text("cart_session_id").notNull(),
  orderId: varchar("order_id"), // null até pagamento confirmado
  entityType: text("entity_type").notNull(), // "cover_protection" | "wireo_option" | "addon_item"
  entityId: varchar("entity_id").notNull(),
  quantity: integer("quantity").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  confirmedAt: timestamp("confirmed_at"), // set pelo webhook MP ao aprovar
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStockReservationSchema = createInsertSchema(stockReservations).omit({ id: true, createdAt: true });
export type InsertStockReservation = z.infer<typeof insertStockReservationSchema>;
export type StockReservation = typeof stockReservations.$inferSelect;
