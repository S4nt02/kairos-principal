import {
  type User, type InsertUser,
  type Category, type Product, type ProductVariant,
  type PaperType, type Finishing, type PriceRule,
  type CartItem, type InsertCartItem,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type Customer, type InsertCustomer,
  type AdminUser, type InsertAdminUser,
  type AuditLog, type InsertAuditLog,
  type StoreSetting,
  type Coupon, type InsertCoupon,
  type Address, type InsertAddress,
  type OrderNote, type InsertOrderNote,
  type EstrategiaPlan, type InsertEstrategiaPlan,
  type EstrategiaStep, type InsertEstrategiaStep,
  type WireoOption, type InsertWireoOption,
  type AddonCategory, type InsertAddonCategory,
  type AddonItem, type InsertAddonItem,
  type ProductAddonCategory, type InsertProductAddonCategory,
  type ProductDiscount, type InsertProductDiscount,
  users, categories, products, productVariants,
  paperTypes, finishings, priceRules,
  cartItems, orders, orderItems, customers,
  adminUsers, auditLog, storeSettings, coupons, addresses, orderNotes,
  estrategiaPlans, estrategiaSteps,
  productFinishings,
  wireoOptions, addonCategories, addonItems, productAddonCategories, productAddonItems,
  productDiscounts, stockReservations,
  type InsertCategory, type InsertProduct, type InsertProductVariant,
  type InsertPaperType, type InsertFinishing, type InsertPriceRule,
} from "../shared/schema";
import { db } from "./db";
import { eq, and, asc, desc, sql, count, sum, gte, lte, like, or, ilike, inArray, isNull, lt, ne } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Gráfica: Catalog
  getCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  getProductsByCategory(categoryId: string): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | undefined>;
  getProductVariants(productId: string): Promise<ProductVariant[]>;
  getPaperTypes(): Promise<PaperType[]>;
  getFinishings(): Promise<Finishing[]>;
  getPriceRules(productId: string): Promise<PriceRule[]>;
  getProductCountByCategory(categoryId: string): Promise<number>;
  searchProducts(query: string, limit?: number): Promise<Product[]>;

  // Cart
  getCartItems(sessionId: string): Promise<CartItem[]>;
  addCartItem(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<CartItem | undefined>;
  removeCartItem(id: string): Promise<void>;
  clearCart(sessionId: string): Promise<void>;

  // Customers
  createCustomer(data: InsertCustomer): Promise<Customer>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  getCustomer(id: string): Promise<Customer | undefined>;
  updateCustomer(id: string, data: Partial<Pick<Customer, "name" | "phone" | "passwordHash">>): Promise<Customer | undefined>;

  // Addresses
  getAddressesByCustomer(customerId: string): Promise<Address[]>;
  getAddress(id: string): Promise<Address | undefined>;
  createAddress(data: InsertAddress): Promise<Address>;
  updateAddress(id: string, data: Partial<InsertAddress>): Promise<Address | undefined>;
  deleteAddress(id: string): Promise<void>;

  // Orders
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getOrdersByCustomer(customerId: string): Promise<Order[]>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  updatePaymentStatus(id: string, paymentStatus: string, externalId?: string): Promise<Order | undefined>;
  addOrderItems(items: InsertOrderItem[]): Promise<OrderItem[]>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  getOrderItemById(id: string): Promise<OrderItem | undefined>;
  updateOrderItemArt(id: string, artFileUrl: string, artStatus: string): Promise<OrderItem | undefined>;

  // Admin Users
  getAdminUsers(): Promise<AdminUser[]>;
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  getAdminUserByEmail(email: string): Promise<AdminUser | undefined>;
  createAdminUser(data: InsertAdminUser): Promise<AdminUser>;
  updateAdminUser(id: string, data: Partial<InsertAdminUser>): Promise<AdminUser | undefined>;
  deleteAdminUser(id: string): Promise<void>;
  updateAdminUserLastLogin(id: string): Promise<void>;

  // Audit Log
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(params: { page: number; pageSize: number; adminUserId?: string; entityType?: string }): Promise<{ data: AuditLog[]; total: number }>;

  // Store Settings
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<StoreSetting[]>;

  // Admin: Dashboard Aggregations
  getDashboardKPIs(dateFrom: Date, dateTo: Date): Promise<{ revenue: number; orders: number; newCustomers: number; avgTicket: number }>;
  getRevenueByPeriod(dateFrom: Date, dateTo: Date, granularity: string): Promise<{ date: string; revenue: number }[]>;
  getOrderStatusDistribution(): Promise<{ status: string; count: number }[]>;
  getTopProducts(limit: number, dateFrom: Date, dateTo: Date): Promise<{ productId: string; productName: string; revenue: number; quantity: number }[]>;
  getOrdersPaginated(params: { page: number; pageSize: number; status?: string; paymentStatus?: string; customerId?: string; dateFrom?: Date; dateTo?: Date; search?: string }): Promise<{ data: Order[]; total: number }>;

  // Admin: Catalog CRUD
  getAllCategoriesAdmin(): Promise<Category[]>;
  getCategoryById(id: string): Promise<Category | undefined>;
  createCategory(data: InsertCategory): Promise<Category>;
  updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;
  getAllProductsAdmin(params: { page: number; pageSize: number; categoryId?: string; search?: string }): Promise<{ data: Product[]; total: number }>;
  getProductById(id: string): Promise<Product | undefined>;
  createProduct(data: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  updateProductStock(id: string, stockQuantity: number): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  createProductVariant(data: InsertProductVariant): Promise<ProductVariant>;
  updateProductVariant(id: string, data: Partial<InsertProductVariant>): Promise<ProductVariant | undefined>;
  deleteProductVariant(id: string): Promise<void>;
  getAllPaperTypesAdmin(): Promise<PaperType[]>;
  createPaperType(data: InsertPaperType): Promise<PaperType>;
  updatePaperType(id: string, data: Partial<InsertPaperType>): Promise<PaperType | undefined>;
  deletePaperType(id: string): Promise<void>;
  getAllFinishingsAdmin(): Promise<Finishing[]>;
  createFinishing(data: InsertFinishing): Promise<Finishing>;
  updateFinishing(id: string, data: Partial<InsertFinishing>): Promise<Finishing | undefined>;
  deleteFinishing(id: string): Promise<void>;
  createPriceRule(data: InsertPriceRule): Promise<PriceRule>;
  updatePriceRule(id: string, data: Partial<InsertPriceRule>): Promise<PriceRule | undefined>;
  deletePriceRule(id: string): Promise<void>;

  // Admin: Customers
  getAllCustomers(params: { page: number; pageSize: number; search?: string }): Promise<{ data: any[]; total: number }>;

  // Admin: Reports
  getPaymentStatusBreakdown(dateFrom: Date, dateTo: Date): Promise<{ status: string; count: number; total: number }[]>;
  getMonthlyComparison(months: number): Promise<{ period: string; revenue: number; orders: number; avgTicket: number }[]>;

  // Shipping label
  updateShippingLabel(id: string, labelUrl: string): Promise<Order | undefined>;

  // Admin: Order tracking
  updateOrderTracking(id: string, trackingCode: string): Promise<Order | undefined>;

  // Coupons
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  incrementCouponUses(id: string): Promise<void>;
  createCoupon(data: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: string, data: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: string): Promise<void>;
  getAllCoupons(): Promise<Coupon[]>;

  // Order Notes
  getOrderNotes(orderId: string): Promise<OrderNote[]>;
  createOrderNote(data: InsertOrderNote): Promise<OrderNote>;

  // Estratégia de Conteúdo
  getActiveEstrategiaPlans(): Promise<EstrategiaPlan[]>;
  getAllEstrategiaPlans(): Promise<EstrategiaPlan[]>;
  createEstrategiaPlan(data: InsertEstrategiaPlan): Promise<EstrategiaPlan>;
  updateEstrategiaPlan(id: string, data: Partial<InsertEstrategiaPlan>): Promise<EstrategiaPlan | undefined>;
  deleteEstrategiaPlan(id: string): Promise<void>;
  getAllEstrategiaSteps(): Promise<EstrategiaStep[]>;
  createEstrategiaStep(data: InsertEstrategiaStep): Promise<EstrategiaStep>;
  updateEstrategiaStep(id: string, data: Partial<InsertEstrategiaStep>): Promise<EstrategiaStep | undefined>;
  deleteEstrategiaStep(id: string): Promise<void>;

  // Product Finishings
  getProductFinishings(productId: string): Promise<Finishing[]>;
  assignFinishingsToProduct(productId: string, finishingIds: string[]): Promise<void>;
  removeFinishingsFromProduct(productId: string): Promise<void>;
  updateFinishingStock(id: string, stockQuantity: number): Promise<void>;

  // Wireo Options
  getWireoOptionsByProduct(productId: string): Promise<WireoOption[]>;
  getAllWireoOptions(): Promise<WireoOption[]>;
  getWireoOption(id: string): Promise<WireoOption | undefined>;
  createWireoOption(data: InsertWireoOption): Promise<WireoOption>;
  updateWireoOption(id: string, data: Partial<InsertWireoOption>): Promise<WireoOption | undefined>;
  deleteWireoOption(id: string): Promise<void>;
  updateWireoOptionStock(id: string, stockQuantity: number): Promise<void>;

  // Addon Categories & Items
  getAllAddonCategories(): Promise<AddonCategory[]>;
  getAddonCategory(id: string): Promise<AddonCategory | undefined>;
  createAddonCategory(data: InsertAddonCategory): Promise<AddonCategory>;
  updateAddonCategory(id: string, data: Partial<InsertAddonCategory>): Promise<AddonCategory | undefined>;
  deleteAddonCategory(id: string): Promise<void>;
  getAddonItemsByCategory(categoryId: string): Promise<AddonItem[]>;
  getAddonItem(id: string): Promise<AddonItem | undefined>;
  createAddonItem(data: InsertAddonItem): Promise<AddonItem>;
  updateAddonItem(id: string, data: Partial<InsertAddonItem>): Promise<AddonItem | undefined>;
  deleteAddonItem(id: string): Promise<void>;
  updateAddonItemStock(id: string, stockQuantity: number): Promise<void>;
  getProductAddonCategories(productId: string): Promise<ProductAddonCategory[]>;
  assignAddonCategoryToProduct(data: InsertProductAddonCategory): Promise<ProductAddonCategory>;
  removeAddonCategoryFromProduct(productId: string, addonCategoryId: string): Promise<void>;
  bulkAssignAddonToCategory(categoryId: string, addonCategoryId: string, maxAllowed: number): Promise<number>;
  getProductAddonItems(productId: string): Promise<AddonItem[]>;
  assignAddonItemsToProduct(productId: string, addonItemIds: string[]): Promise<void>;

  // Product Discounts
  getProductDiscounts(productId: string): Promise<ProductDiscount[]>;
  getActiveProductDiscount(productId: string): Promise<ProductDiscount | undefined>;
  getAllProductDiscounts(): Promise<ProductDiscount[]>;
  createProductDiscount(data: InsertProductDiscount): Promise<ProductDiscount>;
  updateProductDiscount(id: string, data: Partial<InsertProductDiscount>): Promise<ProductDiscount | undefined>;
  deleteProductDiscount(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ── Users ──
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // ── Gráfica: Catalog ──
  async getCategories(): Promise<Category[]> {
    return db
      .select()
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.sortOrder));
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [cat] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.slug, slug), eq(categories.active, true)));
    return cat;
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return db
      .select()
      .from(products)
      .where(and(eq(products.categoryId, categoryId), eq(products.active, true)));
  }

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.active, true)));
    return product;
  }

  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    return db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId));
  }

  async getPaperTypes(): Promise<PaperType[]> {
    return db
      .select()
      .from(paperTypes)
      .where(eq(paperTypes.active, true))
      .orderBy(asc(paperTypes.sortOrder));
  }

  async getFinishings(): Promise<Finishing[]> {
    return db
      .select()
      .from(finishings)
      .where(eq(finishings.active, true))
      .orderBy(asc(finishings.sortOrder));
  }

  async getPriceRules(productId: string): Promise<PriceRule[]> {
    return db
      .select()
      .from(priceRules)
      .where(eq(priceRules.productId, productId))
      .orderBy(asc(priceRules.minQty));
  }

  async getProductCountByCategory(categoryId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(products)
      .where(and(eq(products.categoryId, categoryId), eq(products.active, true)));
    return Number(result?.count || 0);
  }

  async searchProducts(query: string, limit = 20): Promise<Product[]> {
    return db.select().from(products)
      .where(and(
        eq(products.active, true),
        or(
          ilike(products.name, `%${query}%`),
          ilike(products.description, `%${query}%`),
        ),
      ))
      .limit(limit);
  }

  // ── Customers ──
  async createCustomer(data: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(data).returning();
    return customer;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    return customer;
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async updateCustomer(id: string, data: Partial<Pick<Customer, "name" | "phone" | "passwordHash">>): Promise<Customer | undefined> {
    const [updated] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
    return updated;
  }

  // ── Addresses ──
  async getAddressesByCustomer(customerId: string): Promise<Address[]> {
    return db.select().from(addresses).where(eq(addresses.customerId, customerId));
  }

  async getAddress(id: string): Promise<Address | undefined> {
    const [addr] = await db.select().from(addresses).where(eq(addresses.id, id));
    return addr;
  }

  async createAddress(data: InsertAddress): Promise<Address> {
    if (data.isDefault) {
      await db.update(addresses).set({ isDefault: false })
        .where(eq(addresses.customerId, data.customerId));
    }
    const [addr] = await db.insert(addresses).values(data).returning();
    return addr;
  }

  async updateAddress(id: string, data: Partial<InsertAddress>): Promise<Address | undefined> {
    if (data.isDefault) {
      const existing = await this.getAddress(id);
      if (existing) {
        await db.update(addresses).set({ isDefault: false })
          .where(eq(addresses.customerId, existing.customerId));
      }
    }
    const [updated] = await db.update(addresses).set(data).where(eq(addresses.id, id)).returning();
    return updated;
  }

  async deleteAddress(id: string): Promise<void> {
    await db.delete(addresses).where(eq(addresses.id, id));
  }

  // ── Cart ──
  async getCartItems(sessionId: string): Promise<CartItem[]> {
    return db
      .select()
      .from(cartItems)
      .where(eq(cartItems.sessionId, sessionId));
  }

  async addCartItem(item: InsertCartItem): Promise<CartItem> {
    const [cartItem] = await db.insert(cartItems).values(item).returning();
    return cartItem;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const [updated] = await db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, id))
      .returning();
    return updated;
  }

  async removeCartItem(id: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  }

  async clearCart(sessionId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
  }

  // ── Orders ──
  async createOrder(order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values(order).returning();
    return created;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getAllOrders(): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [updated] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  async updatePaymentStatus(id: string, paymentStatus: string, externalId?: string): Promise<Order | undefined> {
    const values: Record<string, any> = { paymentStatus, updatedAt: new Date() };
    if (externalId) values.paymentExternalId = externalId;
    const [updated] = await db
      .update(orders)
      .set(values)
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  async addOrderItems(items: InsertOrderItem[]): Promise<OrderItem[]> {
    if (items.length === 0) return [];
    return db.insert(orderItems).values(items).returning();
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
  }

  async getOrderItemById(id: string): Promise<OrderItem | undefined> {
    const [item] = await db.select().from(orderItems).where(eq(orderItems.id, id));
    return item;
  }

  async updateOrderItemArt(id: string, artFileUrl: string, artStatus: string): Promise<OrderItem | undefined> {
    const [updated] = await db
      .update(orderItems)
      .set({ artFileUrl, artStatus })
      .where(eq(orderItems.id, id))
      .returning();
    return updated;
  }

  // ── Admin Users ──
  async getAdminUsers(): Promise<AdminUser[]> {
    return db.select().from(adminUsers).orderBy(asc(adminUsers.createdAt));
  }

  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return admin;
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return admin;
  }

  async createAdminUser(data: InsertAdminUser): Promise<AdminUser> {
    const [admin] = await db.insert(adminUsers).values(data).returning();
    return admin;
  }

  async updateAdminUser(id: string, data: Partial<InsertAdminUser>): Promise<AdminUser | undefined> {
    const [updated] = await db.update(adminUsers).set(data).where(eq(adminUsers.id, id)).returning();
    return updated;
  }

  async deleteAdminUser(id: string): Promise<void> {
    await db.delete(adminUsers).where(eq(adminUsers.id, id));
  }

  async updateAdminUserLastLogin(id: string): Promise<void> {
    await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, id));
  }

  // ── Audit Log ──
  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLog).values(data).returning();
    return log;
  }

  async getAuditLogs(params: { page: number; pageSize: number; adminUserId?: string; entityType?: string }): Promise<{ data: AuditLog[]; total: number }> {
    const conditions = [];
    if (params.adminUserId) conditions.push(eq(auditLog.adminUserId, params.adminUserId));
    if (params.entityType) conditions.push(eq(auditLog.entityType, params.entityType));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (params.page - 1) * params.pageSize;

    const [data, [{ total }]] = await Promise.all([
      db.select().from(auditLog).where(where).orderBy(desc(auditLog.createdAt)).limit(params.pageSize).offset(offset),
      db.select({ total: count() }).from(auditLog).where(where),
    ]);

    return { data, total: Number(total) };
  }

  // ── Store Settings ──
  async getSetting(key: string): Promise<string | undefined> {
    const [setting] = await db.select().from(storeSettings).where(eq(storeSettings.key, key));
    return setting?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db.insert(storeSettings).values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedAt: new Date() } });
  }

  async getAllSettings(): Promise<StoreSetting[]> {
    return db.select().from(storeSettings);
  }

  // ── Dashboard Aggregations ──
  async getDashboardKPIs(dateFrom: Date, dateTo: Date) {
    const [result] = await db.select({
      revenue: sql<number>`COALESCE(SUM(CAST(${orders.total} AS numeric)), 0)`,
      orders: count(),
      avgTicket: sql<number>`COALESCE(AVG(CAST(${orders.total} AS numeric)), 0)`,
    }).from(orders).where(and(
      gte(orders.createdAt, dateFrom),
      lte(orders.createdAt, dateTo),
    ));

    const [custResult] = await db.select({
      newCustomers: count(),
    }).from(customers).where(and(
      gte(customers.createdAt, dateFrom),
      lte(customers.createdAt, dateTo),
    ));

    return {
      revenue: Number(result?.revenue || 0),
      orders: Number(result?.orders || 0),
      newCustomers: Number(custResult?.newCustomers || 0),
      avgTicket: Number(result?.avgTicket || 0),
    };
  }

  async getRevenueByPeriod(dateFrom: Date, dateTo: Date, granularity: string) {
    const truncExpr = granularity === "month"
      ? sql`date_trunc('month', ${orders.createdAt})`
      : sql`date_trunc('day', ${orders.createdAt})`;

    const result = await db.select({
      date: sql<string>`${truncExpr}::text`,
      revenue: sql<number>`COALESCE(SUM(CAST(${orders.total} AS numeric)), 0)`,
    }).from(orders).where(and(
      gte(orders.createdAt, dateFrom),
      lte(orders.createdAt, dateTo),
    )).groupBy(truncExpr).orderBy(truncExpr);

    return result.map(r => ({ date: r.date, revenue: Number(r.revenue) }));
  }

  async getOrderStatusDistribution() {
    const result = await db.select({
      status: orders.status,
      count: count(),
    }).from(orders).groupBy(orders.status);

    return result.map(r => ({ status: r.status, count: Number(r.count) }));
  }

  async getTopProducts(limit: number, dateFrom: Date, dateTo: Date) {
    const result = await db.select({
      productId: orderItems.productId,
      productName: orderItems.productName,
      revenue: sql<number>`COALESCE(SUM(CAST(${orderItems.subtotal} AS numeric)), 0)`,
      quantity: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(
        gte(orders.createdAt, dateFrom),
        lte(orders.createdAt, dateTo),
      ))
      .groupBy(orderItems.productId, orderItems.productName)
      .orderBy(sql`SUM(CAST(${orderItems.subtotal} AS numeric)) DESC`)
      .limit(limit);

    return result.map(r => ({
      productId: r.productId,
      productName: r.productName,
      revenue: Number(r.revenue),
      quantity: Number(r.quantity),
    }));
  }

  async getOrdersPaginated(params: { page: number; pageSize: number; status?: string; paymentStatus?: string; customerId?: string; dateFrom?: Date; dateTo?: Date; search?: string }) {
    const conditions = [];
    if (params.status) conditions.push(eq(orders.status, params.status));
    if (params.paymentStatus) conditions.push(eq(orders.paymentStatus, params.paymentStatus));
    if (params.customerId) conditions.push(eq(orders.customerId, params.customerId));
    if (params.dateFrom) conditions.push(gte(orders.createdAt, params.dateFrom));
    if (params.dateTo) conditions.push(lte(orders.createdAt, params.dateTo));
    if (params.search) conditions.push(or(
      ilike(orders.id, `%${params.search}%`),
      ilike(orders.notes, `%${params.search}%`),
    ));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (params.page - 1) * params.pageSize;

    const [data, [{ total }]] = await Promise.all([
      db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(params.pageSize).offset(offset),
      db.select({ total: count() }).from(orders).where(where),
    ]);

    return { data, total: Number(total) };
  }

  // ── Admin: Catalog CRUD ──
  async getAllCategoriesAdmin(): Promise<Category[]> {
    return db.select().from(categories).orderBy(asc(categories.sortOrder));
  }

  async getCategoryById(id: string): Promise<Category | undefined> {
    const [cat] = await db.select().from(categories).where(eq(categories.id, id));
    return cat;
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    const [cat] = await db.insert(categories).values(data).returning();
    return cat;
  }

  async updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [cat] = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
    return cat;
  }

  async deleteCategory(id: string): Promise<void> {
    const [{ total }] = await db.select({ total: count() }).from(products).where(eq(products.categoryId, id));
    if (Number(total) > 0) {
      throw Object.assign(new Error("Categoria possui produtos vinculados. Remova ou reatribua os produtos antes de excluir."), { statusCode: 409 });
    }
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getAllProductsAdmin(params: { page: number; pageSize: number; categoryId?: string; search?: string }) {
    const conditions = [];
    if (params.categoryId) conditions.push(eq(products.categoryId, params.categoryId));
    if (params.search) conditions.push(ilike(products.name, `%${params.search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (params.page - 1) * params.pageSize;

    const [data, [{ total }]] = await Promise.all([
      db.select().from(products).where(where).orderBy(desc(products.createdAt)).limit(params.pageSize).offset(offset),
      db.select({ total: count() }).from(products).where(where),
    ]);

    return { data, total: Number(total) };
  }

  async getProductById(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(data: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(data).returning();
    return product;
  }

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return product;
  }

  async updateProductStock(id: string, stockQuantity: number): Promise<void> {
    await db.update(products).set({ stockQuantity }).where(eq(products.id, id));
  }

  async deleteProduct(id: string): Promise<void> {
    const activeOrderRows = await db
      .select({ total: count() })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.productId, id), ne(orders.status, "cancelled")));
    if (Number(activeOrderRows[0].total) > 0) {
      throw Object.assign(new Error("Produto possui pedidos ativos vinculados. Cancele os pedidos antes de excluir."), { statusCode: 409 });
    }
    // Safe to delete: check above guarantees only cancelled-order items remain
    await db.delete(orderItems).where(eq(orderItems.productId, id));
    await db.delete(cartItems).where(eq(cartItems.productId, id));
    await db.delete(productDiscounts).where(eq(productDiscounts.productId, id));
    await db.delete(productFinishings).where(eq(productFinishings.productId, id));
    await db.delete(productAddonCategories).where(eq(productAddonCategories.productId, id));
    await db.delete(productAddonItems).where(eq(productAddonItems.productId, id));
    await db.delete(wireoOptions).where(eq(wireoOptions.productId, id));
    await db.delete(priceRules).where(eq(priceRules.productId, id));
    await db.delete(productVariants).where(eq(productVariants.productId, id));
    await db.delete(products).where(eq(products.id, id));
  }

  async createProductVariant(data: InsertProductVariant): Promise<ProductVariant> {
    const [variant] = await db.insert(productVariants).values(data).returning();
    return variant;
  }

  async updateProductVariant(id: string, data: Partial<InsertProductVariant>): Promise<ProductVariant | undefined> {
    const [variant] = await db.update(productVariants).set(data).where(eq(productVariants.id, id)).returning();
    return variant;
  }

  async deleteProductVariant(id: string): Promise<void> {
    await db.delete(productVariants).where(eq(productVariants.id, id));
  }

  async getAllPaperTypesAdmin(): Promise<PaperType[]> {
    return db.select().from(paperTypes).orderBy(asc(paperTypes.sortOrder));
  }

  async createPaperType(data: InsertPaperType): Promise<PaperType> {
    const [paper] = await db.insert(paperTypes).values(data).returning();
    return paper;
  }

  async updatePaperType(id: string, data: Partial<InsertPaperType>): Promise<PaperType | undefined> {
    const [paper] = await db.update(paperTypes).set(data).where(eq(paperTypes.id, id)).returning();
    return paper;
  }

  async deletePaperType(id: string): Promise<void> {
    const [{ total }] = await db.select({ total: count() }).from(productVariants).where(eq(productVariants.paperTypeId, id));
    if (Number(total) > 0) {
      throw Object.assign(new Error("Tipo de papel está em uso por variantes de produto. Remova as variantes antes de excluir."), { statusCode: 409 });
    }
    await db.delete(paperTypes).where(eq(paperTypes.id, id));
  }

  async getAllFinishingsAdmin(): Promise<Finishing[]> {
    return db.select().from(finishings).orderBy(asc(finishings.sortOrder));
  }

  async createFinishing(data: InsertFinishing): Promise<Finishing> {
    const [finishing] = await db.insert(finishings).values(data).returning();
    return finishing;
  }

  async updateFinishing(id: string, data: Partial<InsertFinishing>): Promise<Finishing | undefined> {
    const [finishing] = await db.update(finishings).set(data).where(eq(finishings.id, id)).returning();
    return finishing;
  }

  async deleteFinishing(id: string): Promise<void> {
    await db.delete(productFinishings).where(eq(productFinishings.finishingId, id));
    await db.update(productVariants).set({ finishingId: null }).where(eq(productVariants.finishingId, id));
    await db.delete(finishings).where(eq(finishings.id, id));
  }

  async createPriceRule(data: InsertPriceRule): Promise<PriceRule> {
    const [rule] = await db.insert(priceRules).values(data).returning();
    return rule;
  }

  async updatePriceRule(id: string, data: Partial<InsertPriceRule>): Promise<PriceRule | undefined> {
    const [rule] = await db.update(priceRules).set(data).where(eq(priceRules.id, id)).returning();
    return rule;
  }

  async deletePriceRule(id: string): Promise<void> {
    await db.delete(priceRules).where(eq(priceRules.id, id));
  }

  // ── Admin: Customers ──
  async getAllCustomers(params: { page: number; pageSize: number; search?: string }) {
    const conditions = [];
    if (params.search) conditions.push(or(
      ilike(customers.name, `%${params.search}%`),
      ilike(customers.email, `%${params.search}%`),
    ));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (params.page - 1) * params.pageSize;

    const [data, [{ total }]] = await Promise.all([
      db.select().from(customers).where(where).orderBy(desc(customers.createdAt)).limit(params.pageSize).offset(offset),
      db.select({ total: count() }).from(customers).where(where),
    ]);

    // Enrich with order stats
    const enriched = await Promise.all(data.map(async (customer) => {
      const [stats] = await db.select({
        orderCount: count(),
        totalSpent: sql<number>`COALESCE(SUM(CAST(${orders.total} AS numeric)), 0)`,
      }).from(orders).where(eq(orders.customerId, customer.id));

      return {
        ...customer,
        orderCount: Number(stats?.orderCount || 0),
        totalSpent: Number(stats?.totalSpent || 0),
      };
    }));

    return { data: enriched, total: Number(total) };
  }

  // ── Admin: Reports ──
  async getPaymentStatusBreakdown(dateFrom: Date, dateTo: Date) {
    const result = await db.select({
      status: orders.paymentStatus,
      count: count(),
      total: sql<number>`COALESCE(SUM(CAST(${orders.total} AS numeric)), 0)`,
    }).from(orders).where(and(
      gte(orders.createdAt, dateFrom),
      lte(orders.createdAt, dateTo),
    )).groupBy(orders.paymentStatus);

    return result.map(r => ({ status: r.status, count: Number(r.count), total: Number(r.total) }));
  }

  async getMonthlyComparison(months: number) {
    const result = await db.select({
      period: sql<string>`to_char(date_trunc('month', ${orders.createdAt}), 'YYYY-MM')`,
      revenue: sql<number>`COALESCE(SUM(CAST(${orders.total} AS numeric)), 0)`,
      orders: count(),
      avgTicket: sql<number>`COALESCE(AVG(CAST(${orders.total} AS numeric)), 0)`,
    }).from(orders)
      .where(gte(orders.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(months))} months'`))
      .groupBy(sql`date_trunc('month', ${orders.createdAt})`)
      .orderBy(sql`date_trunc('month', ${orders.createdAt})`);

    return result.map(r => ({
      period: r.period,
      revenue: Number(r.revenue),
      orders: Number(r.orders),
      avgTicket: Number(r.avgTicket),
    }));
  }

  // ── Shipping label ──
  async updateShippingLabel(id: string, labelUrl: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ shippingLabelUrl: labelUrl, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  // ── Admin: Order tracking ──
  async updateOrderTracking(id: string, trackingCode: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ shippingTrackingCode: trackingCode, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  // ── Coupons ──
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    return coupon;
  }

  async incrementCouponUses(id: string): Promise<void> {
    await db.update(coupons).set({ currentUses: sql`${coupons.currentUses} + 1` }).where(eq(coupons.id, id));
  }

  async createCoupon(data: InsertCoupon): Promise<Coupon> {
    const [coupon] = await db.insert(coupons).values({ ...data, code: data.code.toUpperCase() }).returning();
    return coupon;
  }

  async updateCoupon(id: string, data: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const updateData = { ...data };
    if (updateData.code) updateData.code = updateData.code.toUpperCase();
    const [coupon] = await db.update(coupons).set(updateData).where(eq(coupons.id, id)).returning();
    return coupon;
  }

  async deleteCoupon(id: string): Promise<void> {
    await db.delete(coupons).where(eq(coupons.id, id));
  }

  async getAllCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }

  // ── Order Notes ──
  async getOrderNotes(orderId: string): Promise<OrderNote[]> {
    return db.select().from(orderNotes)
      .where(eq(orderNotes.orderId, orderId))
      .orderBy(desc(orderNotes.createdAt));
  }

  async createOrderNote(data: InsertOrderNote): Promise<OrderNote> {
    const [note] = await db.insert(orderNotes).values(data).returning();
    return note;
  }

  // ── Estratégia de Conteúdo ──
  async getActiveEstrategiaPlans(): Promise<EstrategiaPlan[]> {
    return db.select().from(estrategiaPlans)
      .where(eq(estrategiaPlans.active, true))
      .orderBy(asc(estrategiaPlans.sortOrder));
  }

  async getAllEstrategiaPlans(): Promise<EstrategiaPlan[]> {
    return db.select().from(estrategiaPlans).orderBy(asc(estrategiaPlans.sortOrder));
  }

  async createEstrategiaPlan(data: InsertEstrategiaPlan): Promise<EstrategiaPlan> {
    const [plan] = await db.insert(estrategiaPlans).values(data).returning();
    return plan;
  }

  async updateEstrategiaPlan(id: string, data: Partial<InsertEstrategiaPlan>): Promise<EstrategiaPlan | undefined> {
    const [plan] = await db.update(estrategiaPlans).set(data).where(eq(estrategiaPlans.id, id)).returning();
    return plan;
  }

  async deleteEstrategiaPlan(id: string): Promise<void> {
    await db.delete(estrategiaPlans).where(eq(estrategiaPlans.id, id));
  }

  async getAllEstrategiaSteps(): Promise<EstrategiaStep[]> {
    return db.select().from(estrategiaSteps).orderBy(asc(estrategiaSteps.sortOrder));
  }

  async createEstrategiaStep(data: InsertEstrategiaStep): Promise<EstrategiaStep> {
    const [step] = await db.insert(estrategiaSteps).values(data).returning();
    return step;
  }

  async updateEstrategiaStep(id: string, data: Partial<InsertEstrategiaStep>): Promise<EstrategiaStep | undefined> {
    const [step] = await db.update(estrategiaSteps).set(data).where(eq(estrategiaSteps.id, id)).returning();
    return step;
  }

  async deleteEstrategiaStep(id: string): Promise<void> {
    await db.delete(estrategiaSteps).where(eq(estrategiaSteps.id, id));
  }

  // ── Product Finishings ──

  async getProductFinishings(productId: string): Promise<Finishing[]> {
    return db
      .select({ id: finishings.id, name: finishings.name, type: finishings.type, priceModifier: finishings.priceModifier, multiplier: finishings.multiplier, active: finishings.active, sortOrder: finishings.sortOrder, stockQuantity: finishings.stockQuantity })
      .from(productFinishings)
      .innerJoin(finishings, eq(productFinishings.finishingId, finishings.id))
      .where(and(eq(productFinishings.productId, productId), eq(finishings.active, true)))
      .orderBy(asc(finishings.sortOrder));
  }

  async assignFinishingsToProduct(productId: string, finishingIds: string[]): Promise<void> {
    await db.delete(productFinishings).where(eq(productFinishings.productId, productId));
    if (finishingIds.length === 0) return;
    const values = finishingIds.map((id) => ({ productId, finishingId: id }));
    await db.insert(productFinishings).values(values).onConflictDoNothing();
  }

  async removeFinishingsFromProduct(productId: string): Promise<void> {
    await db.delete(productFinishings).where(eq(productFinishings.productId, productId));
  }

  async updateFinishingStock(id: string, stockQuantity: number): Promise<void> {
    await db.update(finishings).set({ stockQuantity }).where(eq(finishings.id, id));
  }

  // ── Wireo Options ──

  async getWireoOptionsByProduct(productId: string): Promise<WireoOption[]> {
    return db.select().from(wireoOptions).where(and(eq(wireoOptions.productId, productId), eq(wireoOptions.active, true))).orderBy(asc(wireoOptions.sortOrder));
  }

  async getWireoOption(id: string): Promise<WireoOption | undefined> {
    const [row] = await db.select().from(wireoOptions).where(eq(wireoOptions.id, id));
    return row;
  }

  async createWireoOption(data: InsertWireoOption): Promise<WireoOption> {
    const [row] = await db.insert(wireoOptions).values(data).returning();
    return row;
  }

  async updateWireoOption(id: string, data: Partial<InsertWireoOption>): Promise<WireoOption | undefined> {
    const [row] = await db.update(wireoOptions).set(data).where(eq(wireoOptions.id, id)).returning();
    return row;
  }

  async deleteWireoOption(id: string): Promise<void> {
    await db.delete(wireoOptions).where(eq(wireoOptions.id, id));
  }

  async updateWireoOptionStock(id: string, stockQuantity: number): Promise<void> {
    await db.update(wireoOptions).set({ stockQuantity }).where(eq(wireoOptions.id, id));
  }

  async getAllWireoOptions(): Promise<WireoOption[]> {
    return db.select().from(wireoOptions).orderBy(asc(wireoOptions.sortOrder));
  }

  // ── Addon Categories & Items ──

  async getAllAddonCategories(): Promise<AddonCategory[]> {
    return db.select().from(addonCategories).orderBy(asc(addonCategories.sortOrder));
  }

  async getAddonCategory(id: string): Promise<AddonCategory | undefined> {
    const [row] = await db.select().from(addonCategories).where(eq(addonCategories.id, id));
    return row;
  }

  async createAddonCategory(data: InsertAddonCategory): Promise<AddonCategory> {
    const [row] = await db.insert(addonCategories).values(data).returning();
    return row;
  }

  async updateAddonCategory(id: string, data: Partial<InsertAddonCategory>): Promise<AddonCategory | undefined> {
    const [row] = await db.update(addonCategories).set(data).where(eq(addonCategories.id, id)).returning();
    return row;
  }

  async deleteAddonCategory(id: string): Promise<void> {
    // Get all items in this category first
    const items = await db.select({ id: addonItems.id }).from(addonItems).where(eq(addonItems.addonCategoryId, id));
    for (const item of items) {
      await db.delete(productAddonItems).where(eq(productAddonItems.addonItemId, item.id));
    }
    await db.delete(addonItems).where(eq(addonItems.addonCategoryId, id));
    await db.delete(productAddonCategories).where(eq(productAddonCategories.addonCategoryId, id));
    await db.delete(addonCategories).where(eq(addonCategories.id, id));
  }

  async getAddonItemsByCategory(categoryId: string): Promise<AddonItem[]> {
    return db.select().from(addonItems).where(eq(addonItems.addonCategoryId, categoryId)).orderBy(asc(addonItems.sortOrder));
  }

  async getAddonItem(id: string): Promise<AddonItem | undefined> {
    const [row] = await db.select().from(addonItems).where(eq(addonItems.id, id));
    return row;
  }

  async createAddonItem(data: InsertAddonItem): Promise<AddonItem> {
    const [row] = await db.insert(addonItems).values(data).returning();
    return row;
  }

  async updateAddonItem(id: string, data: Partial<InsertAddonItem>): Promise<AddonItem | undefined> {
    const [row] = await db.update(addonItems).set(data).where(eq(addonItems.id, id)).returning();
    return row;
  }

  async deleteAddonItem(id: string): Promise<void> {
    await db.delete(productAddonItems).where(eq(productAddonItems.addonItemId, id));
    await db.delete(addonItems).where(eq(addonItems.id, id));
  }

  async updateAddonItemStock(id: string, stockQuantity: number): Promise<void> {
    await db.update(addonItems).set({ stockQuantity }).where(eq(addonItems.id, id));
  }

  async getProductAddonCategories(productId: string): Promise<ProductAddonCategory[]> {
    return db.select().from(productAddonCategories).where(eq(productAddonCategories.productId, productId));
  }

  async assignAddonCategoryToProduct(data: InsertProductAddonCategory): Promise<ProductAddonCategory> {
    const [row] = await db.insert(productAddonCategories).values(data).onConflictDoNothing().returning();
    return row;
  }

  async removeAddonCategoryFromProduct(productId: string, addonCategoryId: string): Promise<void> {
    await db.delete(productAddonCategories).where(
      and(eq(productAddonCategories.productId, productId), eq(productAddonCategories.addonCategoryId, addonCategoryId)),
    );
  }

  async bulkAssignAddonToCategory(categoryId: string, addonCategoryId: string, maxAllowed: number): Promise<number> {
    const prods = await db.select({ id: products.id }).from(products).where(eq(products.categoryId, categoryId));
    if (prods.length === 0) return 0;
    const values = prods.map((p) => ({ productId: p.id, addonCategoryId, maxAllowed }));
    await db.insert(productAddonCategories).values(values).onConflictDoNothing();
    return prods.length;
  }

  async getProductAddonItems(productId: string): Promise<AddonItem[]> {
    return db
      .select({ id: addonItems.id, addonCategoryId: addonItems.addonCategoryId, name: addonItems.name, description: addonItems.description, imageUrl: addonItems.imageUrl, priceModifier: addonItems.priceModifier, stockQuantity: addonItems.stockQuantity, active: addonItems.active, sortOrder: addonItems.sortOrder, createdAt: addonItems.createdAt })
      .from(productAddonItems)
      .innerJoin(addonItems, eq(productAddonItems.addonItemId, addonItems.id))
      .where(eq(productAddonItems.productId, productId))
      .orderBy(asc(addonItems.sortOrder));
  }

  async assignAddonItemsToProduct(productId: string, addonItemIds: string[]): Promise<void> {
    await db.delete(productAddonItems).where(eq(productAddonItems.productId, productId));
    if (addonItemIds.length === 0) return;
    await db.insert(productAddonItems).values(addonItemIds.map((id) => ({ productId, addonItemId: id }))).onConflictDoNothing();
  }

  // ── Product Discounts ──

  async getProductDiscounts(productId: string): Promise<ProductDiscount[]> {
    return db.select().from(productDiscounts).where(eq(productDiscounts.productId, productId)).orderBy(desc(productDiscounts.createdAt));
  }

  async getActiveProductDiscount(productId: string): Promise<ProductDiscount | undefined> {
    const now = new Date();
    const [row] = await db.select().from(productDiscounts).where(
      and(
        eq(productDiscounts.productId, productId),
        eq(productDiscounts.active, true),
        lte(productDiscounts.validFrom, now),
        gte(productDiscounts.validTo, now),
      ),
    ).limit(1);
    return row;
  }

  async getAllProductDiscounts(): Promise<ProductDiscount[]> {
    return db.select().from(productDiscounts).orderBy(desc(productDiscounts.createdAt));
  }

  async createProductDiscount(data: InsertProductDiscount): Promise<ProductDiscount> {
    const [row] = await db.insert(productDiscounts).values(data).returning();
    return row;
  }

  async updateProductDiscount(id: string, data: Partial<InsertProductDiscount>): Promise<ProductDiscount | undefined> {
    const [row] = await db.update(productDiscounts).set(data).where(eq(productDiscounts.id, id)).returning();
    return row;
  }

  async deleteProductDiscount(id: string): Promise<void> {
    await db.delete(productDiscounts).where(eq(productDiscounts.id, id));
  }
}

export const storage = new DatabaseStorage();
