import type { Express } from "express";
import { storage } from "../storage";
import { requireAdmin, requireRole } from "../middleware/admin-auth";
import { validate } from "../middleware/validate";
import { hashPassword, verifyPassword, generateAdminToken } from "../services/auth";
import {
  calculateShipping,
  addToMelhorEnvioCart, checkoutShipment, generateLabel, getLabelUrl,
  calculatePackage,
} from "../services/shipping";
import { z } from "zod";

// Helper to safely extract string from Express params/query (Express 5 returns string | string[])
function str(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || "";
  return val || "";
}

// ── Validation Schemas ──

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createAdminUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2),
  password: z.string().min(6),
  role: z.enum(["admin", "operador", "financeiro"]).default("operador"),
  active: z.boolean().default(true),
});

const updateAdminUserSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(2).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["admin", "operador", "financeiro"]).optional(),
  active: z.boolean().optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

const updateCategorySchema = createCategorySchema.partial();

const createProductSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  basePrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  minQuantity: z.number().int().positive().default(100),
  quantitySteps: z.array(z.number()).optional(),
  imageUrl: z.string().optional(),
  active: z.boolean().default(true),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

const updateProductSchema = createProductSchema.partial();

const createVariantSchema = z.object({
  productId: z.string().min(1),
  paperTypeId: z.string().min(1),
  finishingId: z.string().optional().nullable(),
  widthMm: z.number().int().positive(),
  heightMm: z.number().int().positive(),
  colorsFront: z.number().int().default(4),
  colorsBack: z.number().int().default(0),
  sku: z.string().min(1),
  priceTable: z.record(z.number()).optional(),
});

const updateVariantSchema = createVariantSchema.partial();

const createPaperTypeSchema = z.object({
  name: z.string().min(1),
  weightGsm: z.number().int().positive(),
  finish: z.string().min(1),
  costPerSheet: z.string().regex(/^\d+(\.\d{1,4})?$/),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const updatePaperTypeSchema = createPaperTypeSchema.partial();

const createFinishingSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  priceModifier: z.string().regex(/^\d+(\.\d{1,4})?$/).default("0"),
  multiplier: z.string().regex(/^\d+(\.\d{1,4})?$/).default("1.0"),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const updateFinishingSchema = createFinishingSchema.partial();

const createPriceRuleSchema = z.object({
  productId: z.string().min(1),
  minQty: z.number().int().positive(),
  maxQty: z.number().int().positive(),
  pricePerUnit: z.string().regex(/^\d+(\.\d{1,4})?$/),
  setupFee: z.string().regex(/^\d+(\.\d{1,2})?$/).default("0"),
});

const updatePriceRuleSchema = createPriceRuleSchema.partial();

const updateOrderStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "production", "shipped", "delivered", "cancelled"]),
});

const updateTrackingSchema = z.object({
  trackingCode: z.string().min(1),
});

const updateArtStatusSchema = z.object({
  orderItemId: z.string().min(1),
  artStatus: z.enum(["pending", "uploaded", "approved", "rejected"]),
});

const updateSettingsSchema = z.object({
  settings: z.record(z.string()),
});

// Helper to create audit log
async function audit(adminUserId: string, action: string, entityType: string, entityId?: string, details?: Record<string, any>, ip?: string) {
  try {
    await storage.createAuditLog({ adminUserId, action, entityType, entityId: entityId ?? null, details: details ?? null, ipAddress: ip ?? null });
  } catch (e) {
    console.error("[Audit] Failed to create audit log:", e);
  }
}

export function registerAdminRoutes(app: Express) {
  // ══════════════════════════════════════════
  // AUTH (no middleware required)
  // ══════════════════════════════════════════

  app.post("/api/admin/auth/login", validate(adminLoginSchema), async (req, res) => {
    const { email, password } = req.body;

    const admin = await storage.getAdminUserByEmail(email);
    if (!admin || !admin.active) {
      res.status(401).json({ message: "Credenciais inválidas" });
      return;
    }

    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Credenciais inválidas" });
      return;
    }

    await storage.updateAdminUserLastLogin(admin.id);
    const token = generateAdminToken(admin.id, admin.role as any);

    res.json({
      token,
      user: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        role: admin.role,
      },
    });
  });

  // ══════════════════════════════════════════
  // DASHBOARD (any admin role)
  // ══════════════════════════════════════════

  app.get("/api/admin/dashboard/kpis", requireAdmin, async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    // Previous period for comparison
    const prevTo = new Date(dateFrom);
    const prevFrom = new Date(dateFrom);
    prevFrom.setDate(prevFrom.getDate() - days);

    const [current, previous] = await Promise.all([
      storage.getDashboardKPIs(dateFrom, dateTo),
      storage.getDashboardKPIs(prevFrom, prevTo),
    ]);

    const calcChange = (curr: number, prev: number) => prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 100);

    res.json({
      revenue: current.revenue,
      revenueChange: calcChange(current.revenue, previous.revenue),
      orders: current.orders,
      ordersChange: calcChange(current.orders, previous.orders),
      newCustomers: current.newCustomers,
      newCustomersChange: calcChange(current.newCustomers, previous.newCustomers),
      avgTicket: current.avgTicket,
      avgTicketChange: calcChange(current.avgTicket, previous.avgTicket),
    });
  });

  app.get("/api/admin/dashboard/revenue-chart", requireAdmin, async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const granularity = days > 90 ? "month" : "day";

    const data = await storage.getRevenueByPeriod(dateFrom, dateTo, granularity);
    res.json(data);
  });

  app.get("/api/admin/dashboard/order-status-distribution", requireAdmin, async (_req, res) => {
    const data = await storage.getOrderStatusDistribution();
    res.json(data);
  });

  app.get("/api/admin/dashboard/top-products", requireAdmin, async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const limit = parseInt(req.query.limit as string) || 5;
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const data = await storage.getTopProducts(limit, dateFrom, dateTo);
    res.json(data);
  });

  app.get("/api/admin/dashboard/recent-orders", requireAdmin, async (_req, res) => {
    const { data } = await storage.getOrdersPaginated({ page: 1, pageSize: 5 });
    res.json(data);
  });

  // ══════════════════════════════════════════
  // ORDERS (admin + operador)
  // ══════════════════════════════════════════

  app.get("/api/admin/orders", requireRole("admin", "operador", "financeiro"), async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const { status, paymentStatus, customerId, search } = req.query as Record<string, string>;
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

    const result = await storage.getOrdersPaginated({ page, pageSize, status, paymentStatus, customerId, dateFrom, dateTo, search });
    res.json({
      ...result,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
    });
  });

  app.get("/api/admin/orders/:id", requireRole("admin", "operador", "financeiro"), async (req, res) => {
    const order = await storage.getOrder(str(req.params.id));
    if (!order) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }

    const items = await storage.getOrderItems(order.id);
    const customer = await storage.getCustomer(order.customerId);

    res.json({
      ...order,
      items,
      customer: customer ? { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } : undefined,
    });
  });

  app.patch("/api/admin/orders/:id/status", requireRole("admin", "operador"), validate(updateOrderStatusSchema), async (req, res) => {
    const updated = await storage.updateOrderStatus(str(req.params.id), req.body.status);
    if (!updated) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }
    await audit(req.adminUserId!, "update_status", "order", str(req.params.id), { status: req.body.status });
    res.json(updated);
  });

  app.patch("/api/admin/orders/:id/tracking", requireRole("admin", "operador"), validate(updateTrackingSchema), async (req, res) => {
    const updated = await storage.updateOrderTracking(str(req.params.id), req.body.trackingCode);
    if (!updated) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }
    await audit(req.adminUserId!, "update_tracking", "order", str(req.params.id), { trackingCode: req.body.trackingCode });
    res.json(updated);
  });

  app.patch("/api/admin/orders/:id/art-status", requireRole("admin", "operador"), validate(updateArtStatusSchema), async (req, res) => {
    const { orderItemId, artStatus } = req.body;
    const item = await storage.updateOrderItemArt(orderItemId, "", artStatus);
    if (!item) {
      res.status(404).json({ message: "Item não encontrado" });
      return;
    }
    await audit(req.adminUserId!, "update_art_status", "order_item", orderItemId, { artStatus });
    res.json(item);
  });

  app.post("/api/admin/orders/:id/generate-label", requireRole("admin", "operador"), async (req, res) => {
    const order = await storage.getOrder(str(req.params.id));
    if (!order) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }

    const { melhorEnvioServiceId, address } = req.body;
    if (!melhorEnvioServiceId || !address) {
      res.status(400).json({ message: "melhorEnvioServiceId e address são obrigatórios" });
      return;
    }

    try {
      const orderItemsList = await storage.getOrderItems(order.id);
      const fakeCartItems = orderItemsList.map((oi) => ({
        id: oi.id, sessionId: "", productId: oi.productId, variantId: oi.variantId,
        quantity: oi.quantity, unitPrice: oi.unitPrice, specifications: oi.specifications,
        artFileUrl: oi.artFileUrl, createdAt: new Date(),
      }));

      const pkg = await calculatePackage(fakeCartItems);
      const insuredValue = parseFloat(order.total);

      const { cartItemId } = await addToMelhorEnvioCart({
        melhorEnvioServiceId, fromCep: process.env.WAREHOUSE_CEP || "01001000",
        toCep: address.cep, toName: address.name || "Cliente",
        toAddress: address.street, toNumber: address.number,
        toComplement: address.complement, toNeighborhood: address.neighborhood,
        toCity: address.city, toState: address.state, pkg, insuredValue, orderId: order.id,
      });

      await checkoutShipment([cartItemId]);
      await generateLabel([cartItemId]);
      const { url } = await getLabelUrl([cartItemId]);

      await audit(req.adminUserId!, "generate_label", "order", str(req.params.id), { labelUrl: url });
      res.json({ labelUrl: url, cartItemId });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Erro ao gerar etiqueta" });
    }
  });

  // ══════════════════════════════════════════
  // CATEGORIES (admin only)
  // ══════════════════════════════════════════

  app.get("/api/admin/categories", requireRole("admin"), async (_req, res) => {
    const cats = await storage.getAllCategoriesAdmin();
    // Enrich with product count
    const result = await Promise.all(cats.map(async (cat) => {
      const prods = await storage.getProductsByCategory(cat.id);
      return { ...cat, productCount: prods.length };
    }));
    res.json(result);
  });

  app.post("/api/admin/categories", requireRole("admin"), validate(createCategorySchema), async (req, res) => {
    const cat = await storage.createCategory(req.body);
    await audit(req.adminUserId!, "create", "category", cat.id);
    res.status(201).json(cat);
  });

  app.patch("/api/admin/categories/:id", requireRole("admin"), validate(updateCategorySchema), async (req, res) => {
    const cat = await storage.updateCategory(str(req.params.id), req.body);
    if (!cat) {
      res.status(404).json({ message: "Categoria não encontrada" });
      return;
    }
    await audit(req.adminUserId!, "update", "category", str(req.params.id));
    res.json(cat);
  });

  app.delete("/api/admin/categories/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteCategory(str(req.params.id));
    await audit(req.adminUserId!, "delete", "category", str(req.params.id));
    res.status(204).send();
  });

  // ══════════════════════════════════════════
  // PRODUCTS (admin only)
  // ══════════════════════════════════════════

  app.get("/api/admin/products", requireRole("admin"), async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const { categoryId, search } = req.query as Record<string, string>;
    const result = await storage.getAllProductsAdmin({ page, pageSize, categoryId, search });
    res.json({ ...result, page, pageSize, totalPages: Math.ceil(result.total / pageSize) });
  });

  app.get("/api/admin/products/:id", requireRole("admin"), async (req, res) => {
    const product = await storage.getProductById(str(req.params.id));
    if (!product) {
      res.status(404).json({ message: "Produto não encontrado" });
      return;
    }
    const variants = await storage.getProductVariants(product.id);
    const rules = await storage.getPriceRules(product.id);
    res.json({ ...product, variants, priceRules: rules });
  });

  app.post("/api/admin/products", requireRole("admin"), validate(createProductSchema), async (req, res) => {
    const product = await storage.createProduct(req.body);
    await audit(req.adminUserId!, "create", "product", product.id);
    res.status(201).json(product);
  });

  app.patch("/api/admin/products/:id", requireRole("admin"), validate(updateProductSchema), async (req, res) => {
    const product = await storage.updateProduct(str(req.params.id), req.body);
    if (!product) {
      res.status(404).json({ message: "Produto não encontrado" });
      return;
    }
    await audit(req.adminUserId!, "update", "product", str(req.params.id));
    res.json(product);
  });

  app.delete("/api/admin/products/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteProduct(str(req.params.id));
    await audit(req.adminUserId!, "delete", "product", str(req.params.id));
    res.status(204).send();
  });

  // ── Variants ──

  app.post("/api/admin/products/:id/variants", requireRole("admin"), validate(createVariantSchema), async (req, res) => {
    const variant = await storage.createProductVariant({ ...req.body, productId: str(req.params.id) });
    await audit(req.adminUserId!, "create", "variant", variant.id);
    res.status(201).json(variant);
  });

  app.patch("/api/admin/variants/:id", requireRole("admin"), validate(updateVariantSchema), async (req, res) => {
    const variant = await storage.updateProductVariant(str(req.params.id), req.body);
    if (!variant) {
      res.status(404).json({ message: "Variante não encontrada" });
      return;
    }
    await audit(req.adminUserId!, "update", "variant", str(req.params.id));
    res.json(variant);
  });

  app.delete("/api/admin/variants/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteProductVariant(str(req.params.id));
    await audit(req.adminUserId!, "delete", "variant", str(req.params.id));
    res.status(204).send();
  });

  // ── Price Rules ──

  app.post("/api/admin/products/:id/price-rules", requireRole("admin"), validate(createPriceRuleSchema), async (req, res) => {
    const rule = await storage.createPriceRule({ ...req.body, productId: str(req.params.id) });
    await audit(req.adminUserId!, "create", "price_rule", rule.id);
    res.status(201).json(rule);
  });

  app.patch("/api/admin/price-rules/:id", requireRole("admin"), validate(updatePriceRuleSchema), async (req, res) => {
    const rule = await storage.updatePriceRule(str(req.params.id), req.body);
    if (!rule) {
      res.status(404).json({ message: "Regra não encontrada" });
      return;
    }
    await audit(req.adminUserId!, "update", "price_rule", str(req.params.id));
    res.json(rule);
  });

  app.delete("/api/admin/price-rules/:id", requireRole("admin"), async (req, res) => {
    await storage.deletePriceRule(str(req.params.id));
    await audit(req.adminUserId!, "delete", "price_rule", str(req.params.id));
    res.status(204).send();
  });

  // ══════════════════════════════════════════
  // PAPER TYPES (admin only)
  // ══════════════════════════════════════════

  app.get("/api/admin/paper-types", requireRole("admin"), async (_req, res) => {
    const data = await storage.getAllPaperTypesAdmin();
    res.json(data);
  });

  app.post("/api/admin/paper-types", requireRole("admin"), validate(createPaperTypeSchema), async (req, res) => {
    const paper = await storage.createPaperType(req.body);
    await audit(req.adminUserId!, "create", "paper_type", paper.id);
    res.status(201).json(paper);
  });

  app.patch("/api/admin/paper-types/:id", requireRole("admin"), validate(updatePaperTypeSchema), async (req, res) => {
    const paper = await storage.updatePaperType(str(req.params.id), req.body);
    if (!paper) {
      res.status(404).json({ message: "Tipo de papel não encontrado" });
      return;
    }
    await audit(req.adminUserId!, "update", "paper_type", str(req.params.id));
    res.json(paper);
  });

  app.delete("/api/admin/paper-types/:id", requireRole("admin"), async (req, res) => {
    await storage.deletePaperType(str(req.params.id));
    await audit(req.adminUserId!, "delete", "paper_type", str(req.params.id));
    res.status(204).send();
  });

  // ══════════════════════════════════════════
  // FINISHINGS (admin only)
  // ══════════════════════════════════════════

  app.get("/api/admin/finishings", requireRole("admin"), async (_req, res) => {
    const data = await storage.getAllFinishingsAdmin();
    res.json(data);
  });

  app.post("/api/admin/finishings", requireRole("admin"), validate(createFinishingSchema), async (req, res) => {
    const finishing = await storage.createFinishing(req.body);
    await audit(req.adminUserId!, "create", "finishing", finishing.id);
    res.status(201).json(finishing);
  });

  app.patch("/api/admin/finishings/:id", requireRole("admin"), validate(updateFinishingSchema), async (req, res) => {
    const finishing = await storage.updateFinishing(str(req.params.id), req.body);
    if (!finishing) {
      res.status(404).json({ message: "Acabamento não encontrado" });
      return;
    }
    await audit(req.adminUserId!, "update", "finishing", str(req.params.id));
    res.json(finishing);
  });

  app.delete("/api/admin/finishings/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteFinishing(str(req.params.id));
    await audit(req.adminUserId!, "delete", "finishing", str(req.params.id));
    res.status(204).send();
  });

  // ══════════════════════════════════════════
  // CUSTOMERS (admin + operador)
  // ══════════════════════════════════════════

  app.get("/api/admin/customers", requireRole("admin", "operador", "financeiro"), async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const search = req.query.search as string;
    const result = await storage.getAllCustomers({ page, pageSize, search });
    res.json({ ...result, page, pageSize, totalPages: Math.ceil(result.total / pageSize) });
  });

  app.get("/api/admin/customers/:id", requireRole("admin", "operador", "financeiro"), async (req, res) => {
    const customer = await storage.getCustomer(str(req.params.id));
    if (!customer) {
      res.status(404).json({ message: "Cliente não encontrado" });
      return;
    }
    const customerOrders = await storage.getOrdersByCustomer(customer.id);
    res.json({ ...customer, orders: customerOrders });
  });

  // ══════════════════════════════════════════
  // REPORTS (admin + financeiro)
  // ══════════════════════════════════════════

  app.get("/api/admin/reports/revenue", requireRole("admin", "financeiro"), async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const granularity = days > 90 ? "month" : "day";

    const data = await storage.getRevenueByPeriod(dateFrom, dateTo, granularity);
    res.json(data);
  });

  app.get("/api/admin/reports/payment-status", requireRole("admin", "financeiro"), async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const data = await storage.getPaymentStatusBreakdown(dateFrom, dateTo);
    res.json(data);
  });

  app.get("/api/admin/reports/top-products", requireRole("admin", "financeiro"), async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const limit = parseInt(req.query.limit as string) || 10;
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const data = await storage.getTopProducts(limit, dateFrom, dateTo);
    res.json(data);
  });

  app.get("/api/admin/reports/monthly-comparison", requireRole("admin", "financeiro"), async (req, res) => {
    const months = parseInt(req.query.months as string) || 12;
    const data = await storage.getMonthlyComparison(months);
    res.json(data);
  });

  app.get("/api/admin/reports/export/csv", requireRole("admin", "financeiro"), async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const { data: ordersList } = await storage.getOrdersPaginated({ page: 1, pageSize: 10000, dateFrom, dateTo });

    const csvRows = ["ID,Data,Status,Pagamento,Subtotal,Frete,Total"];
    for (const order of ordersList) {
      csvRows.push([
        order.id,
        new Date(order.createdAt).toISOString().split("T")[0],
        order.status,
        order.paymentStatus,
        order.subtotal,
        order.shippingCost,
        order.total,
      ].join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=relatorio-${dateFrom.toISOString().split("T")[0]}-${dateTo.toISOString().split("T")[0]}.csv`);
    res.send(csvRows.join("\n"));
  });

  // ══════════════════════════════════════════
  // SETTINGS (admin only)
  // ══════════════════════════════════════════

  app.get("/api/admin/settings", requireRole("admin"), async (_req, res) => {
    const settings = await storage.getAllSettings();
    const map: Record<string, string> = {};
    settings.forEach(s => { map[s.key] = s.value; });
    res.json(map);
  });

  app.patch("/api/admin/settings", requireRole("admin"), validate(updateSettingsSchema), async (req, res) => {
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await storage.setSetting(key, value as string);
    }
    await audit(req.adminUserId!, "update", "settings", undefined, { keys: Object.keys(settings) });
    res.json({ success: true });
  });

  app.get("/api/admin/settings/api-status", requireRole("admin"), async (_req, res) => {
    const statuses = [];

    // MercadoPago — test real connection
    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) {
      statuses.push({ service: "MercadoPago", connected: false, details: "MP_ACCESS_TOKEN não configurado" });
    } else {
      try {
        const mpRes = await fetch("https://api.mercadopago.com/v1/payment_methods", {
          headers: { Authorization: `Bearer ${mpToken}` },
        });
        if (mpRes.ok) {
          statuses.push({ service: "MercadoPago", connected: true, details: `Conectado (${mpRes.status})` });
        } else {
          const body = await mpRes.text().catch(() => "");
          statuses.push({ service: "MercadoPago", connected: false, details: `Erro ${mpRes.status}: ${body.slice(0, 120)}` });
        }
      } catch (err: any) {
        statuses.push({ service: "MercadoPago", connected: false, details: `Falha na conexão: ${err?.message || err}` });
      }
    }

    // Melhor Envio — test real connection
    const meToken = process.env.MELHOR_ENVIO_TOKEN;
    if (!meToken) {
      statuses.push({ service: "Melhor Envio", connected: false, details: "MELHOR_ENVIO_TOKEN não configurado" });
    } else {
      const isSandbox = process.env.MELHOR_ENVIO_SANDBOX === "true" || meToken.startsWith("sandbox");
      const meBaseUrl = isSandbox ? "https://sandbox.melhorenvio.com.br" : "https://api.melhorenvio.com.br";
      try {
        const meRes = await fetch(`${meBaseUrl}/api/v2/me`, {
          headers: {
            Authorization: `Bearer ${meToken}`,
            Accept: "application/json",
            "User-Agent": "Kairos Grafica (contato@kairos.com.br)",
          },
        });
        if (meRes.ok) {
          const meData = await meRes.json().catch(() => ({})) as any;
          const env = isSandbox ? "Sandbox" : "Produção";
          statuses.push({ service: "Melhor Envio", connected: true, details: `${env} — ${meData?.firstname || "OK"} (${meRes.status})` });
        } else {
          const body = await meRes.text().catch(() => "");
          const env = isSandbox ? "Sandbox" : "Produção";
          statuses.push({ service: "Melhor Envio", connected: false, details: `${env} — Erro ${meRes.status}: ${body.slice(0, 120)}` });
        }
      } catch (err: any) {
        statuses.push({ service: "Melhor Envio", connected: false, details: `Falha na conexão: ${err?.message || err}` });
      }
    }

    // Database
    try {
      await storage.getCategories();
      statuses.push({ service: "Database", connected: true, details: "Conectado" });
    } catch {
      statuses.push({ service: "Database", connected: false, details: "Erro de conexão" });
    }

    res.json(statuses);
  });

  // ══════════════════════════════════════════
  // ADMIN USERS (admin only)
  // ══════════════════════════════════════════

  app.get("/api/admin/users", requireRole("admin"), async (_req, res) => {
    const admins = await storage.getAdminUsers();
    const safe = admins.map(({ passwordHash, ...rest }) => rest);
    res.json(safe);
  });

  app.post("/api/admin/users", requireRole("admin"), validate(createAdminUserSchema), async (req, res) => {
    const { password, ...rest } = req.body;

    const existing = await storage.getAdminUserByEmail(rest.email);
    if (existing) {
      res.status(409).json({ message: "E-mail já cadastrado" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const admin = await storage.createAdminUser({ ...rest, passwordHash });
    await audit(req.adminUserId!, "create", "admin_user", admin.id);

    const { passwordHash: _, ...safe } = admin;
    res.status(201).json(safe);
  });

  app.patch("/api/admin/users/:id", requireRole("admin"), validate(updateAdminUserSchema), async (req, res) => {
    // Prevent self-role change
    if (str(req.params.id) === req.adminUserId && req.body.role) {
      res.status(400).json({ message: "Não é possível alterar o próprio role" });
      return;
    }

    const updateData: any = { ...req.body };
    if (updateData.password) {
      updateData.passwordHash = await hashPassword(updateData.password);
      delete updateData.password;
    }

    const admin = await storage.updateAdminUser(str(req.params.id), updateData);
    if (!admin) {
      res.status(404).json({ message: "Admin não encontrado" });
      return;
    }

    await audit(req.adminUserId!, "update", "admin_user", str(req.params.id));
    const { passwordHash: _, ...safe } = admin;
    res.json(safe);
  });

  app.delete("/api/admin/users/:id", requireRole("admin"), async (req, res) => {
    if (str(req.params.id) === req.adminUserId) {
      res.status(400).json({ message: "Não é possível deletar a si mesmo" });
      return;
    }
    await storage.deleteAdminUser(str(req.params.id));
    await audit(req.adminUserId!, "delete", "admin_user", str(req.params.id));
    res.status(204).send();
  });

  // ══════════════════════════════════════════
  // AUDIT LOG (admin only)
  // ══════════════════════════════════════════

  app.get("/api/admin/audit-log", requireRole("admin"), async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const { adminUserId, entityType } = req.query as Record<string, string>;

    const result = await storage.getAuditLogs({ page, pageSize, adminUserId, entityType });
    res.json({ ...result, page, pageSize, totalPages: Math.ceil(result.total / pageSize) });
  });
}
