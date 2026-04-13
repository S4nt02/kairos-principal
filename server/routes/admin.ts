import type { Express } from "express";
import { storage } from "../storage";
import { requireAdmin, requireRole } from "../middleware/admin-auth";
import {
  validate,
  createWireoOptionSchema, updateWireoOptionSchema,
  createAddonCategorySchema, updateAddonCategorySchema,
  createAddonItemSchema, updateAddonItemSchema,
  createProductDiscountSchema, updateProductDiscountSchema,
  bulkAssignAddonSchema,
  stockUpdateSchema, assignFinishingsToProductSchema,
} from "../middleware/validate";
import { hashPassword, verifyPassword, generateAdminToken } from "../services/auth";
import {
  calculateShipping,
  addToMelhorEnvioCart, checkoutShipment, generateLabel, getLabelUrl,
  calculatePackage,
  autoGenerateLabel,
} from "../services/shipping";
import { z } from "zod";
import { authLimiter } from "../middleware/rate-limit";
import { triggerOrderEmail } from "../services/email";
import { getSignedArtUrl, uploadProductImage } from "../services/storage-client";
import { createRefund } from "../services/mercadopago";
import multer from "multer";

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
  quantitySteps: z.array(z.number()).nullable().optional(),
  imageUrl: z.string().optional(),
  active: z.boolean().default(true),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  stockQuantity: z.number().int().min(0).default(0),
});

const updateProductSchema = createProductSchema.partial();

const createVariantSchema = z.object({
  productId: z.string().min(1).optional(),
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
  costPerSheet: z.string().transform((v) => v.replace(",", ".")).pipe(z.string().regex(/^\d+(\.\d{1,4})?$/)),
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
  productId: z.string().min(1).optional(),
  minQty: z.number().int().positive(),
  maxQty: z.number().int().positive(),
  pricePerUnit: z.string().regex(/^\d+(\.\d{1,4})?$/),
  setupFee: z.string().regex(/^\d+(\.\d{1,2})?$/).default("0"),
});

const updatePriceRuleSchema = createPriceRuleSchema.partial();

const updateOrderStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "production", "shipped", "delivered", "cancelled"]),
});

const createCouponSchema = z.object({
  code: z.string().min(1),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.string().regex(/^\d+(\.\d{1,2})?$/),
  minOrderAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).default("0"),
  maxUses: z.number().int().positive().nullable().optional(),
  validFrom: z.string().min(1),
  validTo: z.string().min(1),
  active: z.boolean().default(true),
});

const updateCouponSchema = createCouponSchema.partial();

const updateTrackingSchema = z.object({
  trackingCode: z.string().min(1),
});

const updateArtStatusSchema = z.object({
  orderItemId: z.string().min(1),
  artStatus: z.enum(["pending", "uploaded", "approved", "rejected"]),
});

const createOrderNoteSchema = z.object({
  content: z.string().min(1).max(5000),
});

const updateSettingsSchema = z.object({
  settings: z.record(z.string()),
});

const createEstrategiaPlanSchema = z.object({
  name: z.string().min(1),
  price: z.string().min(1),
  period: z.string().default("/mês"),
  recommended: z.boolean().default(false),
  features: z.array(z.string()).default([]),
  whatsappMessage: z.string().default(""),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

const updateEstrategiaPlanSchema = createEstrategiaPlanSchema.partial();

const createEstrategiaStepSchema = z.object({
  number: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  sortOrder: z.number().int().default(0),
});

const updateEstrategiaStepSchema = createEstrategiaStepSchema.partial();

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
  // IMAGE UPLOAD (admin only)
  // ══════════════════════════════════════════

  const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Apenas imagens são permitidas"));
      }
    },
  });

  app.post("/api/admin/upload-image", requireAdmin, imageUpload.single("file"), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ message: "Nenhuma imagem enviada" });
      return;
    }

    try {
      const url = await uploadProductImage(req.file.buffer, req.file.originalname, req.file.mimetype);
      res.json({ url });
    } catch (err: any) {
      console.error("[Upload] Product image error:", err?.message || err);
      res.status(500).json({ message: err?.message || "Erro ao fazer upload da imagem" });
    }
  });

  // ══════════════════════════════════════════
  // AUTH (no middleware required)
  // ══════════════════════════════════════════

  app.post("/api/admin/auth/login", authLimiter, validate(adminLoginSchema), async (req, res) => {
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
    const orderId = str(req.params.id);
    const order = await storage.getOrder(orderId);
    if (!order) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }

    const updated = await storage.updateOrderStatus(orderId, req.body.status);
    if (!updated) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }
    // Auto-approve payment when confirming a WhatsApp Pix order
    if (req.body.status === "confirmed" && order.paymentMethod === "whatsapp_pix" && order.paymentStatus === "pending") {
      await storage.updatePaymentStatus(orderId, "approved");
    }

    await audit(req.adminUserId!, "update_status", "order", orderId, { status: req.body.status });
    triggerOrderEmail(orderId, req.body.status).catch(() => {});

    // Auto-generate shipping label when moving to confirmed/production and no label exists yet
    if (["confirmed", "production"].includes(req.body.status) && !updated.shippingLabelUrl) {
      autoGenerateLabel(orderId).catch(() => {});
    }

    // Auto-refund via MercadoPago when cancelling a paid order
    if (req.body.status === "cancelled" && order.paymentStatus === "approved" && order.paymentExternalId) {
      createRefund(order.paymentExternalId)
        .then((result) => {
          console.log(`[Refund] Order ${orderId} refunded: ${JSON.stringify(result)}`);
          return storage.updatePaymentStatus(orderId, "refunded");
        })
        .catch((err) => {
          console.error(`[Refund] Failed for order ${orderId}:`, err?.message || err);
        });
    }

    res.json(updated);
  });

  app.patch("/api/admin/orders/:id/tracking", requireRole("admin", "operador"), validate(updateTrackingSchema), async (req, res) => {
    const updated = await storage.updateOrderTracking(str(req.params.id), req.body.trackingCode);
    if (!updated) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }
    await audit(req.adminUserId!, "update_tracking", "order", str(req.params.id), { trackingCode: req.body.trackingCode });
    if (updated.status === "shipped") {
      triggerOrderEmail(str(req.params.id), "shipped", req.body.trackingCode).catch(() => {});
    }
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

  app.get("/api/admin/orders/:id/art/:itemId/download", requireRole("admin", "operador"), async (req, res) => {
    const orderItem = await storage.getOrderItemById(str(req.params.itemId));
    if (!orderItem || orderItem.orderId !== str(req.params.id)) {
      res.status(404).json({ message: "Item não encontrado" });
      return;
    }

    if (!orderItem.artFileUrl) {
      res.status(404).json({ message: "Nenhum arquivo de arte enviado" });
      return;
    }

    try {
      // Extract the storage path from the public URL
      const url = new URL(orderItem.artFileUrl);
      const pathMatch = url.pathname.match(/\/object\/public\/art-files\/(.+)$/);
      if (!pathMatch) {
        // If URL isn't a Supabase URL, redirect directly
        res.redirect(orderItem.artFileUrl);
        return;
      }
      const signedUrl = await getSignedArtUrl(pathMatch[1]);
      res.redirect(signedUrl);
    } catch (err: any) {
      console.error("[Admin] Art download error:", err?.message || err);
      // Fallback: redirect to the stored URL
      res.redirect(orderItem.artFileUrl);
    }
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

      const meProducts = orderItemsList.map((oi) => ({
        name: oi.productName,
        quantity: oi.quantity,
        unitary_value: parseFloat(oi.subtotal) / oi.quantity || 1,
      }));

      const { cartItemId } = await addToMelhorEnvioCart({
        melhorEnvioServiceId, fromCep: process.env.WAREHOUSE_CEP || "01001000",
        toCep: address.cep, toName: address.name || "Cliente",
        toAddress: address.street, toNumber: address.number,
        toComplement: address.complement, toNeighborhood: address.neighborhood,
        toCity: address.city, toState: address.state, pkg, insuredValue, orderId: order.id,
        products: meProducts,
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

  // ── Order Notes ──

  app.get("/api/admin/orders/:id/notes", requireRole("admin", "operador", "financeiro"), async (req, res) => {
    const notes = await storage.getOrderNotes(str(req.params.id));
    res.json(notes);
  });

  app.post("/api/admin/orders/:id/notes", requireRole("admin", "operador"), validate(createOrderNoteSchema), async (req, res) => {
    const admin = await storage.getAdminUser(req.adminUserId!);
    const note = await storage.createOrderNote({
      orderId: str(req.params.id),
      authorName: admin?.displayName || "Admin",
      content: req.body.content,
    });
    res.status(201).json(note);
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

  app.patch("/api/admin/products/:id/stock", requireRole("admin", "operador"), validate(stockUpdateSchema), async (req, res) => {
    await storage.updateProductStock(str(req.params.id), req.body.stockQuantity);
    res.json({ ok: true });
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
  // COUPONS (admin only)
  // ══════════════════════════════════════════

  app.get("/api/admin/coupons", requireRole("admin"), async (_req, res) => {
    const data = await storage.getAllCoupons();
    res.json(data);
  });

  app.post("/api/admin/coupons", requireRole("admin"), validate(createCouponSchema), async (req, res) => {
    const data = {
      ...req.body,
      validFrom: new Date(req.body.validFrom),
      validTo: new Date(req.body.validTo),
      maxUses: req.body.maxUses ?? null,
    };
    const coupon = await storage.createCoupon(data);
    await audit(req.adminUserId!, "create", "coupon", coupon.id);
    res.status(201).json(coupon);
  });

  app.patch("/api/admin/coupons/:id", requireRole("admin"), validate(updateCouponSchema), async (req, res) => {
    const data: Record<string, any> = { ...req.body };
    if (data.validFrom) data.validFrom = new Date(data.validFrom);
    if (data.validTo) data.validTo = new Date(data.validTo);
    const coupon = await storage.updateCoupon(str(req.params.id), data);
    if (!coupon) {
      res.status(404).json({ message: "Cupom não encontrado" });
      return;
    }
    await audit(req.adminUserId!, "update", "coupon", str(req.params.id));
    res.json(coupon);
  });

  app.delete("/api/admin/coupons/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteCoupon(str(req.params.id));
    await audit(req.adminUserId!, "delete", "coupon", str(req.params.id));
    res.status(204).send();
  });

  // ══════════════════════════════════════════
  // ESTRATÉGIA DE CONTEÚDO (admin only)
  // ══════════════════════════════════════════

  app.get("/api/admin/estrategia/plans", requireRole("admin"), async (_req, res) => {
    const data = await storage.getAllEstrategiaPlans();
    res.json(data);
  });

  app.post("/api/admin/estrategia/plans", requireRole("admin"), validate(createEstrategiaPlanSchema), async (req, res) => {
    const plan = await storage.createEstrategiaPlan(req.body);
    await audit(req.adminUserId!, "create", "estrategia_plan", plan.id);
    res.status(201).json(plan);
  });

  app.patch("/api/admin/estrategia/plans/:id", requireRole("admin"), validate(updateEstrategiaPlanSchema), async (req, res) => {
    const plan = await storage.updateEstrategiaPlan(str(req.params.id), req.body);
    if (!plan) {
      res.status(404).json({ message: "Plano não encontrado" });
      return;
    }
    await audit(req.adminUserId!, "update", "estrategia_plan", str(req.params.id));
    res.json(plan);
  });

  app.delete("/api/admin/estrategia/plans/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteEstrategiaPlan(str(req.params.id));
    await audit(req.adminUserId!, "delete", "estrategia_plan", str(req.params.id));
    res.status(204).send();
  });

  app.get("/api/admin/estrategia/steps", requireRole("admin"), async (_req, res) => {
    const data = await storage.getAllEstrategiaSteps();
    res.json(data);
  });

  app.post("/api/admin/estrategia/steps", requireRole("admin"), validate(createEstrategiaStepSchema), async (req, res) => {
    const step = await storage.createEstrategiaStep(req.body);
    await audit(req.adminUserId!, "create", "estrategia_step", step.id);
    res.status(201).json(step);
  });

  app.patch("/api/admin/estrategia/steps/:id", requireRole("admin"), validate(updateEstrategiaStepSchema), async (req, res) => {
    const step = await storage.updateEstrategiaStep(str(req.params.id), req.body);
    if (!step) {
      res.status(404).json({ message: "Passo não encontrado" });
      return;
    }
    await audit(req.adminUserId!, "update", "estrategia_step", str(req.params.id));
    res.json(step);
  });

  app.delete("/api/admin/estrategia/steps/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteEstrategiaStep(str(req.params.id));
    await audit(req.adminUserId!, "delete", "estrategia_step", str(req.params.id));
    res.status(204).send();
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
      const isSandbox = process.env.MELHOR_ENVIO_SANDBOX !== "false";
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

  // ══════════════════════════════════════════
  // PRODUCT FINISHINGS (admin only)
  // ══════════════════════════════════════════

  app.get("/api/admin/products/:productId/finishings", requireRole("admin"), async (req, res) => {
    res.json(await storage.getProductFinishings(str(req.params.productId)));
  });

  app.put("/api/admin/products/:productId/finishings", requireRole("admin"), validate(assignFinishingsToProductSchema), async (req, res) => {
    await storage.assignFinishingsToProduct(str(req.params.productId), req.body.finishingIds);
    await audit(req.adminUserId!, "update", "product_finishings", str(req.params.productId), req.body);
    res.json({ ok: true });
  });

  app.patch("/api/admin/finishings/:id/stock", requireRole("admin"), validate(stockUpdateSchema), async (req, res) => {
    await storage.updateFinishingStock(str(req.params.id), req.body.stockQuantity);
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════
  // WIRE-O OPTIONS (admin only)
  // ══════════════════════════════════════════

  app.get("/api/admin/wireo-options", requireRole("admin"), async (req, res) => {
    const productId = str(req.query.productId as string);
    if (!productId) { res.status(400).json({ message: "productId é obrigatório" }); return; }
    res.json(await storage.getWireoOptionsByProduct(productId));
  });

  app.post("/api/admin/wireo-options", requireRole("admin"), validate(createWireoOptionSchema), async (req, res) => {
    const item = await storage.createWireoOption(req.body);
    await audit(req.adminUserId!, "create", "wireo_option", item.id, req.body);
    res.status(201).json(item);
  });

  app.put("/api/admin/wireo-options/:id", requireRole("admin"), validate(updateWireoOptionSchema), async (req, res) => {
    const item = await storage.updateWireoOption(str(req.params.id), req.body);
    if (!item) { res.status(404).json({ message: "Não encontrado" }); return; }
    await audit(req.adminUserId!, "update", "wireo_option", item.id, req.body);
    res.json(item);
  });

  app.delete("/api/admin/wireo-options/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteWireoOption(str(req.params.id));
    await audit(req.adminUserId!, "delete", "wireo_option", str(req.params.id));
    res.status(204).send();
  });

  app.patch("/api/admin/wireo-options/:id/stock", requireRole("admin"), validate(stockUpdateSchema), async (req, res) => {
    await storage.updateWireoOptionStock(str(req.params.id), req.body.stockQuantity);
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════
  // ADDON CATEGORIES & ITEMS (admin only)
  // ══════════════════════════════════════════

  app.get("/api/admin/addon-categories", requireRole("admin"), async (_req, res) => {
    const cats = await storage.getAllAddonCategories();
    const withItems = await Promise.all(cats.map(async (cat) => ({
      ...cat,
      items: await storage.getAddonItemsByCategory(cat.id),
    })));
    res.json(withItems);
  });

  app.post("/api/admin/addon-categories", requireRole("admin"), validate(createAddonCategorySchema), async (req, res) => {
    const cat = await storage.createAddonCategory(req.body);
    await audit(req.adminUserId!, "create", "addon_category", cat.id, req.body);
    res.status(201).json(cat);
  });

  app.put("/api/admin/addon-categories/:id", requireRole("admin"), validate(updateAddonCategorySchema), async (req, res) => {
    const cat = await storage.updateAddonCategory(str(req.params.id), req.body);
    if (!cat) { res.status(404).json({ message: "Não encontrado" }); return; }
    await audit(req.adminUserId!, "update", "addon_category", cat.id, req.body);
    res.json(cat);
  });

  app.delete("/api/admin/addon-categories/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteAddonCategory(str(req.params.id));
    await audit(req.adminUserId!, "delete", "addon_category", str(req.params.id));
    res.status(204).send();
  });

  app.post("/api/admin/addon-items", requireRole("admin"), validate(createAddonItemSchema), async (req, res) => {
    const item = await storage.createAddonItem(req.body);
    await audit(req.adminUserId!, "create", "addon_item", item.id, req.body);
    res.status(201).json(item);
  });

  app.put("/api/admin/addon-items/:id", requireRole("admin"), validate(updateAddonItemSchema), async (req, res) => {
    const item = await storage.updateAddonItem(str(req.params.id), req.body);
    if (!item) { res.status(404).json({ message: "Não encontrado" }); return; }
    await audit(req.adminUserId!, "update", "addon_item", item.id, req.body);
    res.json(item);
  });

  app.delete("/api/admin/addon-items/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteAddonItem(str(req.params.id));
    await audit(req.adminUserId!, "delete", "addon_item", str(req.params.id));
    res.status(204).send();
  });

  app.patch("/api/admin/addon-items/:id/stock", requireRole("admin"), validate(stockUpdateSchema), async (req, res) => {
    await storage.updateAddonItemStock(str(req.params.id), req.body.stockQuantity);
    res.json({ ok: true });
  });

  app.get("/api/admin/products/:productId/addon-categories", requireRole("admin"), async (req, res) => {
    res.json(await storage.getProductAddonCategories(str(req.params.productId)));
  });

  app.get("/api/admin/products/:productId/addon-items", requireRole("admin"), async (req, res) => {
    res.json(await storage.getProductAddonItems(str(req.params.productId)));
  });

  app.put("/api/admin/products/:productId/addon-items", requireRole("admin"), async (req, res) => {
    const { addonItemIds } = req.body;
    if (!Array.isArray(addonItemIds)) { res.status(400).json({ message: "addonItemIds deve ser um array" }); return; }
    await storage.assignAddonItemsToProduct(str(req.params.productId), addonItemIds);
    await audit(req.adminUserId!, "update", "product_addon_items", str(req.params.productId), req.body);
    res.json({ ok: true });
  });

  app.post("/api/admin/products/:productId/addon-categories", requireRole("admin"), async (req, res) => {
    const { addonCategoryId, maxAllowed = 1 } = req.body;
    if (!addonCategoryId) { res.status(400).json({ message: "addonCategoryId é obrigatório" }); return; }
    const link = await storage.assignAddonCategoryToProduct({
      productId: str(req.params.productId),
      addonCategoryId,
      maxAllowed: Number(maxAllowed),
    });
    await audit(req.adminUserId!, "update", "product_addon_categories", str(req.params.productId), req.body);
    res.status(201).json(link);
  });

  app.delete("/api/admin/products/:productId/addon-categories/:addonCategoryId", requireRole("admin"), async (req, res) => {
    await storage.removeAddonCategoryFromProduct(str(req.params.productId), str(req.params.addonCategoryId));
    await audit(req.adminUserId!, "delete", "product_addon_categories", str(req.params.productId));
    res.status(204).send();
  });

  app.post("/api/admin/bulk-assign/addon-categories", requireRole("admin"), validate(bulkAssignAddonSchema), async (req, res) => {
    const { categoryId, addonCategoryId, maxAllowed } = req.body;
    const affected = await storage.bulkAssignAddonToCategory(categoryId, addonCategoryId, maxAllowed);
    await audit(req.adminUserId!, "bulk_assign", "addon_categories", categoryId, req.body);
    res.json({ affectedProducts: affected });
  });

  // ══════════════════════════════════════════
  // PRODUCT DISCOUNTS (admin only)
  // ══════════════════════════════════════════

  app.get("/api/admin/product-discounts", requireRole("admin"), async (req, res) => {
    const productId = str(req.query.productId as string);
    if (productId) {
      res.json(await storage.getProductDiscounts(productId));
    } else {
      res.json(await storage.getAllProductDiscounts());
    }
  });

  app.post("/api/admin/product-discounts", requireRole("admin"), validate(createProductDiscountSchema), async (req, res) => {
    const discount = await storage.createProductDiscount(req.body);
    await audit(req.adminUserId!, "create", "product_discount", discount.id, req.body);
    res.status(201).json(discount);
  });

  app.put("/api/admin/product-discounts/:id", requireRole("admin"), validate(updateProductDiscountSchema), async (req, res) => {
    const discount = await storage.updateProductDiscount(str(req.params.id), req.body);
    if (!discount) { res.status(404).json({ message: "Não encontrado" }); return; }
    await audit(req.adminUserId!, "update", "product_discount", discount.id, req.body);
    res.json(discount);
  });

  app.delete("/api/admin/product-discounts/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteProductDiscount(str(req.params.id));
    await audit(req.adminUserId!, "delete", "product_discount", str(req.params.id));
    res.status(204).send();
  });

  // ══════════════════════════════════════════
  // STOCK OVERVIEW (admin + operador)
  // ══════════════════════════════════════════

  app.get("/api/admin/stock", requireRole("admin", "operador"), async (_req, res) => {
    const [allFinishings, addonCats, productsResult, allWireo] = await Promise.all([
      storage.getAllFinishingsAdmin(),
      storage.getAllAddonCategories(),
      storage.getAllProductsAdmin({ page: 1, pageSize: 1000 }),
      storage.getAllWireoOptions(),
    ]);

    const productItems = productsResult.data.map((p) => ({
      id: p.id,
      name: p.name,
      entityType: "product" as const,
      stockQuantity: p.stockQuantity ?? 0,
    }));

    const finishingItems = allFinishings.map((f) => ({
      id: f.id,
      name: f.name,
      entityType: "finishing" as const,
      stockQuantity: f.stockQuantity,
    }));

    const wireoItems = allWireo.map((w) => ({
      id: w.id,
      name: w.name,
      entityType: "wireo_option" as const,
      stockQuantity: w.stockQuantity,
    }));

    const addonItemsAll = (await Promise.all(
      addonCats.map((cat) => storage.getAddonItemsByCategory(cat.id)),
    )).flat().map((i) => ({
      id: i.id,
      name: i.name,
      entityType: "addon_item" as const,
      stockQuantity: i.stockQuantity,
    }));

    res.json([...productItems, ...finishingItems, ...wireoItems, ...addonItemsAll]);
  });
}
