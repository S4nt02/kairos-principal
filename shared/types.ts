import type { Category, Product, PaperType, Finishing, ProductVariant, PriceRule, CartItem, Order, OrderItem, Address, AdminUser, Customer, WireoOption, AddonCategory, AddonItem, ProductAddonCategory, ProductDiscount } from "./schema";

export interface PriceRange {
  min: number;
  max: number;
}

export interface CategoryWithCount extends Category {
  productCount: number;
}

export interface AddonCategoryWithItems extends AddonCategory {
  items: AddonItem[];
  maxAllowed: number;
}

export interface ProductWithDetails extends Product {
  category: Category;
  variants: ProductVariant[];
  availablePapers: PaperType[];
  availableFinishings: Finishing[];
  priceRange: PriceRange;
  priceRules: PriceRule[];
  mioloType?: PaperType | null;
  availableWireoOptions: WireoOption[];
  addonCategories: AddonCategoryWithItems[];
  activeDiscount?: ProductDiscount | null;
}

export interface CategoryWithProducts extends Category {
  products: Array<Product & { priceRange: PriceRange }>;
}

export interface CartItemWithProduct extends CartItem {
  product: Product;
  variant?: ProductVariant;
}

export interface CartSummary {
  items: CartItemWithProduct[];
  itemCount: number;
  subtotal: number;
}

export interface OrderWithItems extends Order {
  items: (OrderItem & { product?: Product })[];
  address?: Address;
}

export interface ShippingQuote {
  carrier: string;
  service: string;
  price: number;
  deliveryDays: number;
  melhorEnvioId?: number;
}

export interface CheckoutData {
  sessionId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  shippingOption: ShippingQuote;
  paymentMethod: "pix" | "boleto" | "card";
  notes?: string;
}

// ── Admin Types ──

export type AdminRole = "admin" | "operador" | "financeiro";

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardKPIs {
  revenue: number;
  revenueChange: number;
  orders: number;
  ordersChange: number;
  newCustomers: number;
  newCustomersChange: number;
  avgTicket: number;
  avgTicketChange: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
}

export interface OrderStatusCount {
  status: string;
  count: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  revenue: number;
  quantity: number;
}

export interface FinancialReport {
  period: string;
  revenue: number;
  orders: number;
  avgTicket: number;
  margin: number;
  change: number;
}

export interface PaymentStatusBreakdown {
  status: string;
  count: number;
  total: number;
}

export interface AdminUserInfo {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ApiConnectionStatus {
  service: string;
  connected: boolean;
  details?: string;
}

export interface AdminOrderDetail extends OrderWithItems {
  customer?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
}

export interface CustomerWithStats extends Customer {
  orderCount: number;
  totalSpent: number;
}

// ── Personalização ──

export interface StockSummaryItem {
  id: string;
  name: string;
  entityType: "finishing" | "wireo_option" | "addon_item";
  stockQuantity: number;
  activeReservations: number;
  available: number;
}
