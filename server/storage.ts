import {
  type User, type InsertUser,
  type Category, type Product, type ProductVariant,
  type PaperType, type Finishing, type PriceRule,
  type CartItem, type InsertCartItem,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  users, categories, products, productVariants,
  paperTypes, finishings, priceRules,
  cartItems, orders, orderItems,
} from "../shared/schema";
import { db } from "./db";
import { eq, and, asc, desc } from "drizzle-orm";

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

  // Orders
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByCustomer(customerId: string): Promise<Order[]>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  updatePaymentStatus(id: string, paymentStatus: string, externalId?: string): Promise<Order | undefined>;
  addOrderItems(items: InsertOrderItem[]): Promise<OrderItem[]>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  updateOrderItemArt(id: string, artFileUrl: string, artStatus: string): Promise<OrderItem | undefined>;
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
}

export const storage = new DatabaseStorage();
