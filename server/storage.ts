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
  users, categories, products, productVariants,
  paperTypes, finishings, priceRules,
  cartItems, orders, orderItems, customers,
  adminUsers, auditLog, storeSettings,
  type InsertCategory, type InsertProduct, type InsertProductVariant,
  type InsertPaperType, type InsertFinishing, type InsertPriceRule,
} from "../shared/schema";
import { db } from "./db";
import { eq, and, asc, desc, sql, count, sum, gte, lte, like, or, ilike } from "drizzle-orm";

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

  // Orders
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getOrdersByCustomer(customerId: string): Promise<Order[]>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  updatePaymentStatus(id: string, paymentStatus: string, externalId?: string): Promise<Order | undefined>;
  addOrderItems(items: InsertOrderItem[]): Promise<OrderItem[]>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
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

  async deleteProduct(id: string): Promise<void> {
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
}

export const storage = new DatabaseStorage();
