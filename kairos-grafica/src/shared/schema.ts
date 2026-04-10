// ─────────────────────────────────────────────────────────────────────────────
// Frontend-only type definitions (no drizzle-orm dependency)
// Mirror of kairos-principal/shared/schema.ts — types only
// ─────────────────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  username: string;
  password: string;
};

export type AdminUser = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: string;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export type AuditLog = {
  id: string;
  adminUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  createdAt: Date;
};

export type StoreSetting = {
  key: string;
  value: string;
  updatedAt: Date;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  icon: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
};

export type Product = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: string;
  minQuantity: number;
  quantitySteps: number[] | null;
  imageUrl: string | null;
  active: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: Date;
};

export type PaperType = {
  id: string;
  name: string;
  weightGsm: number;
  finish: string;
  costPerSheet: string;
  active: boolean;
  sortOrder: number;
};

export type Finishing = {
  id: string;
  name: string;
  type: string;
  priceModifier: string;
  multiplier: string;
  active: boolean;
  sortOrder: number;
};

export type ProductVariant = {
  id: string;
  productId: string;
  paperTypeId: string;
  finishingId: string | null;
  widthMm: number;
  heightMm: number;
  colorsFront: number;
  colorsBack: number;
  sku: string;
  priceTable: Record<string, number> | null;
};

export type PriceRule = {
  id: string;
  productId: string;
  minQty: number;
  maxQty: number;
  pricePerUnit: string;
  setupFee: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  createdAt: Date;
};

export type Address = {
  id: string;
  customerId: string;
  label: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
};

export type Order = {
  id: string;
  customerId: string;
  status: string;
  addressId: string | null;
  subtotal: string;
  shippingCost: string;
  total: string;
  paymentMethod: string | null;
  paymentStatus: string;
  paymentExternalId: string | null;
  mpPreferenceId: string | null;
  shippingTrackingCode: string | null;
  shippingAddress: {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
  } | null;
  shippingServiceId: number | null;
  shippingLabelUrl: string | null;
  couponCode: string | null;
  discountAmount: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  specifications: Record<string, string> | null;
  artFileUrl: string | null;
  artStatus: string | null;
};

export type Coupon = {
  id: string;
  code: string;
  discountType: string;
  discountValue: string;
  minOrderAmount: string;
  maxUses: number | null;
  currentUses: number;
  validFrom: Date;
  validTo: Date;
  active: boolean;
  createdAt: Date;
};

export type CartItem = {
  id: string;
  sessionId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: string;
  specifications: Record<string, string> | null;
  artFileUrl: string | null;
  createdAt: Date;
};

export type OrderNote = {
  id: string;
  orderId: string;
  authorName: string;
  content: string;
  createdAt: Date;
};

export type EstrategiaPlan = {
  id: string;
  name: string;
  price: string;
  period: string;
  recommended: boolean;
  features: string[];
  whatsappMessage: string;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
};

export type EstrategiaStep = {
  id: string;
  number: string;
  title: string;
  description: string;
  sortOrder: number;
  createdAt: Date;
};

export type WireoOption = {
  id: string;
  productId: string;
  name: string;
  colorHex: string | null;
  sizeMm: number | null;
  priceModifier: string;
  stockQuantity: number;
  active: boolean;
  sortOrder: number;
};

export type AddonCategory = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
};

export type AddonItem = {
  id: string;
  addonCategoryId: string;
  name: string;
  description: string | null;
  priceModifier: string;
  stockQuantity: number;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
};

export type ProductDiscount = {
  id: string;
  productId: string;
  name: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  validFrom: Date;
  validTo: Date;
  active: boolean;
  createdAt: Date;
};

export type InsertUser = Omit<User, "id">;
export type InsertAdminUser = Omit<AdminUser, "id" | "lastLoginAt" | "createdAt">;
export type InsertAuditLog = Omit<AuditLog, "id" | "createdAt">;
export type InsertCategory = Omit<Category, "id" | "createdAt">;
export type InsertProduct = Omit<Product, "id" | "createdAt">;
export type InsertPaperType = Omit<PaperType, "id">;
export type InsertFinishing = Omit<Finishing, "id">;
export type InsertProductVariant = Omit<ProductVariant, "id">;
export type InsertPriceRule = Omit<PriceRule, "id">;
export type InsertCustomer = Omit<Customer, "id" | "createdAt">;
export type InsertAddress = Omit<Address, "id">;
export type InsertOrder = Omit<Order, "id" | "createdAt" | "updatedAt">;
export type InsertOrderItem = Omit<OrderItem, "id">;
export type InsertCoupon = Omit<Coupon, "id" | "currentUses" | "createdAt">;
export type InsertCartItem = Omit<CartItem, "id" | "createdAt">;
export type InsertOrderNote = Omit<OrderNote, "id" | "createdAt">;
export type InsertEstrategiaPlan = Omit<EstrategiaPlan, "id" | "createdAt">;
export type InsertEstrategiaStep = Omit<EstrategiaStep, "id" | "createdAt">;
