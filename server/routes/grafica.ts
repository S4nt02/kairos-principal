import type { Express } from "express";
import { storage } from "../storage";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import type { CategoryWithCount, CategoryWithProducts, ProductWithDetails, AddonCategoryWithItems } from "../../shared/types";
import {
  validate, addCartItemSchema, updateCartItemSchema,
  checkoutSchema, updateStatusSchema,
  registerSchema, loginSchema,
  createAddressSchema, updateAddressSchema,
  updateProfileSchema, changePasswordSchema,
} from "../middleware/validate";
import { calculateServerPrice, isPriceMismatch } from "../services/price-engine";
import { reserveStock, confirmReservations, releaseOrderReservations, type ReserveItem } from "../services/stock-reservation";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";
import { hashPassword, verifyPassword, generateToken } from "../services/auth";
import {
  createPreference, getPayment,
  mapPaymentStatus, mapPaymentMethod,
  createRefund,
} from "../services/mercadopago";
import {
  calculateShipping,
  autoGenerateLabel,
  getTrackingInfo,
} from "../services/shipping";
import { authLimiter, checkoutLimiter } from "../middleware/rate-limit";
import { triggerOrderEmail, sendWelcomeEmail } from "../services/email";
import { uploadArtFile } from "../services/storage-client";
import multer from "multer";

export function registerGraficaRoutes(app: Express): void {

  // ── Gráfica: Categories ──

  app.get("/api/grafica/categories", async (_req, res) => {
    const categories = await storage.getCategories();
    const result: CategoryWithCount[] = await Promise.all(
      categories.map(async (cat) => {
        const productCount = await storage.getProductCountByCategory(cat.id);
        return { ...cat, productCount };
      }),
    );
    res.json(result);
  });

  app.get("/api/grafica/categories/:slug", async (req, res) => {
    const category = await storage.getCategoryBySlug(req.params.slug);
    if (!category) {
      res.status(404).json({ message: "Categoria não encontrada" });
      return;
    }

    const products = await storage.getProductsByCategory(category.id);
    const productsWithPrice = await Promise.all(
      products.map(async (product) => {
        const rules = await storage.getPriceRules(product.id);
        const prices = rules.map((r) => parseFloat(r.pricePerUnit));
        const priceRange = prices.length > 0
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : { min: parseFloat(product.basePrice), max: parseFloat(product.basePrice) };
        return { ...product, priceRange };
      }),
    );

    const result: CategoryWithProducts = {
      ...category,
      products: productsWithPrice,
    };
    res.json(result);
  });

  // ── Gráfica: Products ──

  app.get("/api/grafica/products/:slug", async (req, res) => {
    const product = await storage.getProductBySlug(req.params.slug);
    if (!product) {
      res.status(404).json({ message: "Produto não encontrado" });
      return;
    }

    const category = await storage.getCategoryById(product.categoryId);
    if (!category) {
      res.status(404).json({ message: "Categoria do produto não encontrada" });
      return;
    }

    const variants = await storage.getProductVariants(product.id);
    const priceRules = await storage.getPriceRules(product.id);
    const allPapers = await storage.getPaperTypes();

    const usedPaperIds = new Set(variants.map((v) => v.paperTypeId));

    const prices = priceRules.map((r) => parseFloat(r.pricePerUnit));
    const priceRange = prices.length > 0
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : { min: parseFloat(product.basePrice), max: parseFloat(product.basePrice) };

    // Personalização: finalizações do produto, wire-o, adereços, desconto ativo
    const [
      availableFinishings,
      availableWireoOptions,
      assignedAddonItems,
      activeDiscount,
    ] = await Promise.all([
      storage.getProductFinishings(product.id),
      storage.getWireoOptionsByProduct(product.id),
      storage.getProductAddonItems(product.id),
      storage.getActiveProductDiscount(product.id),
    ]);

    // Group assigned addon items by category
    const addonCategoryMap = new Map<string, typeof assignedAddonItems>();
    for (const item of assignedAddonItems) {
      const catId = item.addonCategoryId;
      if (!addonCategoryMap.has(catId)) addonCategoryMap.set(catId, []);
      addonCategoryMap.get(catId)!.push(item);
    }

    const addonCategories: AddonCategoryWithItems[] = (
      await Promise.all(
        Array.from(addonCategoryMap.entries()).map(async ([catId, items]) => {
          const cat = await storage.getAddonCategory(catId);
          if (!cat) return null;
          return {
            ...cat,
            items: items.filter((i) => i.active),
            maxAllowed: items.length,
          };
        }),
      )
    ).filter((c): c is AddonCategoryWithItems => c !== null);

    // Miolo paper type (fixed attribute)
    const mioloType = product.mioloTypeId
      ? allPapers.find((p) => p.id === product.mioloTypeId) ?? null
      : null;

    const result: ProductWithDetails = {
      ...product,
      category,
      variants,
      availablePapers: allPapers.filter((p) => usedPaperIds.has(p.id)),
      availableFinishings,
      priceRange,
      priceRules,
      mioloType,
      availableWireoOptions,
      addonCategories,
      activeDiscount: activeDiscount ?? null,
    };
    res.json(result);
  });

  // ── Gráfica: Product Search ──

  app.get("/api/grafica/search", async (req, res) => {
    const q = (req.query.q as string || "").trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }
    const products = await storage.searchProducts(q);
    const enriched = await Promise.all(
      products.map(async (product) => {
        const rules = await storage.getPriceRules(product.id);
        const prices = rules.map((r) => parseFloat(r.pricePerUnit));
        const priceRange = prices.length > 0
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : { min: parseFloat(product.basePrice), max: parseFloat(product.basePrice) };
        return { ...product, priceRange };
      }),
    );
    res.json(enriched);
  });

  // ── Gráfica: Paper Types & Finishings ──

  app.get("/api/grafica/paper-types", async (_req, res) => {
    const paperTypes = await storage.getPaperTypes();
    res.json(paperTypes);
  });

  app.get("/api/grafica/finishings", async (_req, res) => {
    const finishings = await storage.getFinishings();
    res.json(finishings);
  });

  // ── Cart Routes ──

  app.get("/api/grafica/cart/:sessionId", async (req, res) => {
    const items = await storage.getCartItems(req.params.sessionId);

    const uniqueProductIds = Array.from(new Set(items.map((i) => i.productId)));
    const productResults = await Promise.all(uniqueProductIds.map((id) => storage.getProductById(id)));
    const productMap = new Map(productResults.filter(Boolean).map((p) => [p!.id, p!]));

    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = productMap.get(item.productId);
        let variant;
        if (product && item.variantId) {
          const variants = await storage.getProductVariants(product.id);
          variant = variants.find((v) => v.id === item.variantId);
        }
        return { ...item, product: product!, variant };
      }),
    );

    const validItems = itemsWithProducts.filter((i) => i.product);
    const subtotal = validItems.reduce(
      (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
      0,
    );

    res.json({
      items: validItems,
      itemCount: validItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
    });
  });

  app.post("/api/grafica/cart", validate(addCartItemSchema), async (req, res) => {
    const { productId, quantity, unitPrice, wireoOptionId, addonItemIds, finishingIds } = req.body;

    // PRICE_MISMATCH guard — recalculate server-side before trusting client price
    try {
      const serverResult = await calculateServerPrice(productId, {
        wireoOptionId,
        addonItemIds,
        finishingIds,
      }, quantity);

      if (isPriceMismatch(parseFloat(unitPrice), serverResult.unitPrice)) {
        console.warn("[Cart] PRICE_MISMATCH", {
          productId,
          clientUnitPrice: unitPrice,
          serverUnitPrice: serverResult.unitPrice,
        });
        res.status(422).json({ error: "PRICE_MISMATCH", message: "O preço informado não confere. Atualize a página e tente novamente." });
        return;
      }
    } catch {
      // If price engine fails (e.g. product not found), continue — order will be flagged on checkout
    }

    const cartItem = await storage.addCartItem(req.body);
    res.status(201).json(cartItem);
  });

  app.patch("/api/grafica/cart/:id", validate(updateCartItemSchema), async (req, res) => {
    const { quantity } = req.body;
    const updated = await storage.updateCartItem(req.params.id as string, quantity);
    if (!updated) {
      res.status(404).json({ message: "Item não encontrado" });
      return;
    }
    res.json(updated);
  });

  app.delete("/api/grafica/cart/item/:id", async (req, res) => {
    await storage.removeCartItem(req.params.id);
    res.status(204).send();
  });

  app.delete("/api/grafica/cart/session/:sessionId", async (req, res) => {
    await storage.clearCart(req.params.sessionId);
    res.status(204).send();
  });

  // ── Order Routes ──

  // NOTE: Order creation only happens via POST /api/grafica/checkout (authenticated).
  // There is no standalone POST /api/grafica/orders endpoint.

  app.get("/api/grafica/orders/:id", requireAuth, async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }
    if (order.customerId !== req.customerId) {
      res.status(403).json({ message: "Acesso negado" });
      return;
    }
    const items = await storage.getOrderItems(order.id);
    res.json({ ...order, items });
  });

  // ── Shipping ──

  app.post("/api/grafica/shipping/quote", async (req, res) => {
    const { cep, sessionId } = req.body;
    const cleanCep = (cep || "").replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      res.status(400).json({ message: "CEP inválido" });
      return;
    }

    try {
      const items = sessionId ? await storage.getCartItems(sessionId) : [];
      const quotes = await calculateShipping({ destinationCep: cleanCep, items });
      res.json(quotes);
    } catch (err: any) {
      console.error("[Shipping] Quote error:", err?.message || err);
      res.json([
        { carrier: "Correios", service: "PAC", price: 18.9, deliveryDays: 8 },
        { carrier: "Correios", service: "SEDEX", price: 32.5, deliveryDays: 3 },
        { carrier: "Jadlog", service: ".Package", price: 22.4, deliveryDays: 5 },
      ]);
    }
  });

  // ── CEP Lookup ──

  app.get("/api/grafica/address/:cep", async (req, res) => {
    const cep = req.params.cep.replace(/\D/g, "");
    if (cep.length !== 8) {
      res.status(400).json({ message: "CEP inválido" });
      return;
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json() as any;
      if (data.erro) {
        res.status(404).json({ message: "CEP não encontrado" });
        return;
      }
      res.json({
        cep: data.cep,
        street: data.logradouro,
        neighborhood: data.bairro,
        city: data.localidade,
        state: data.uf,
        complement: data.complemento,
      });
    } catch {
      res.status(500).json({ message: "Erro ao consultar CEP" });
    }
  });

  // ── Auth Routes ──

  app.post("/api/grafica/auth/register", authLimiter, validate(registerSchema), async (req, res) => {
    const { name, email, phone, password } = req.body;

    const existing = await storage.getCustomerByEmail(email);
    if (existing) {
      res.status(409).json({ message: "E-mail já cadastrado" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const customer = await storage.createCustomer({ name, email, phone: phone || null, passwordHash });
    const token = generateToken(customer.id);

    sendWelcomeEmail(email, name).catch(() => {});

    res.status(201).json({
      token,
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    });
  });

  app.post("/api/grafica/auth/login", authLimiter, validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;

    const customer = await storage.getCustomerByEmail(email);
    if (!customer) {
      res.status(401).json({ message: "E-mail ou senha incorretos" });
      return;
    }

    const valid = await verifyPassword(password, customer.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "E-mail ou senha incorretos" });
      return;
    }

    const token = generateToken(customer.id);
    res.json({
      token,
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    });
  });

  app.get("/api/grafica/auth/me", requireAuth, async (req, res) => {
    const customer = await storage.getCustomer(req.customerId!);
    if (!customer) {
      res.status(404).json({ message: "Cliente não encontrado" });
      return;
    }
    res.json({ id: customer.id, name: customer.name, email: customer.email, phone: customer.phone });
  });

  // ── Checkout ──

  app.post("/api/grafica/checkout", checkoutLimiter, requireAuth, validate(checkoutSchema), async (req, res) => {
    const { sessionId, customerName, customerEmail, customerPhone, address, shippingOption, notes, couponCode } = req.body;

    const cartItemsList = await storage.getCartItems(sessionId);
    if (cartItemsList.length === 0) {
      res.status(400).json({ message: "Carrinho vazio" });
      return;
    }

    const subtotal = cartItemsList.reduce(
      (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
      0,
    );
    const shippingCost = shippingOption?.price || 0;

    let discountAmount = 0;
    let appliedCouponCode: string | null = null;
    if (couponCode) {
      const coupon = await storage.getCouponByCode(couponCode);
      if (coupon && coupon.active) {
        const now = new Date();
        const inPeriod = now >= new Date(coupon.validFrom) && now <= new Date(coupon.validTo);
        const hasUses = coupon.maxUses === null || coupon.currentUses < coupon.maxUses;
        const meetsMin = subtotal >= parseFloat(coupon.minOrderAmount);

        if (inPeriod && hasUses && meetsMin) {
          if (coupon.discountType === "percentage") {
            discountAmount = subtotal * parseFloat(coupon.discountValue) / 100;
          } else {
            discountAmount = parseFloat(coupon.discountValue);
          }
          discountAmount = Math.min(discountAmount, subtotal);
          appliedCouponCode = coupon.code;
          await storage.incrementCouponUses(coupon.id);
        }
      }
    }

    const total = subtotal - discountAmount + shippingCost;

    const orderNotes = [notes, `__sessionId:${sessionId}`].filter(Boolean).join("\n");

    // Build stock reserve items from all cart items
    const reserveItems: ReserveItem[] = [];
    for (const item of cartItemsList) {
      // Reserve the product itself
      reserveItems.push({ entityType: "product", entityId: item.productId, quantity: item.quantity });

      const specs = item.specifications as Record<string, string> | null ?? {};
      if (specs["__wireoOptionId"]) {
        reserveItems.push({ entityType: "wireo_option", entityId: specs["__wireoOptionId"], quantity: 1 });
      }
      if (specs["__addonItemIds"]) {
        try {
          const ids: string[] = JSON.parse(specs["__addonItemIds"]);
          for (const id of ids) {
            reserveItems.push({ entityType: "addon_item", entityId: id, quantity: 1 });
          }
        } catch { /* malformed — skip */ }
      }
    }

    // Atomic: reserve stock + create order inside a single transaction
    let order: Awaited<ReturnType<typeof storage.createOrder>>;
    try {
      order = await db.transaction(async (tx) => {
        // Reserve stock (throws InsufficientStockError on failure → auto-rollback)
        if (reserveItems.length > 0) {
          await reserveStock(tx, sessionId, reserveItems);
        }

        const [newOrder] = await tx
          .insert((await import("../../shared/schema")).orders)
          .values({
            customerId: req.customerId!,
            status: "pending",
            addressId: null,
            subtotal: subtotal.toFixed(2),
            shippingCost: shippingCost.toFixed(2),
            total: total.toFixed(2),
            paymentMethod: (process.env.PAYMENT_MODE || "mercadopago") === "whatsapp" ? "whatsapp_pix" : "mercadopago",
            paymentStatus: "pending",
            paymentExternalId: null,
            mpPreferenceId: null,
            shippingTrackingCode: null,
            shippingAddress: address || null,
            shippingServiceId: shippingOption?.melhorEnvioId ?? null,
            shippingLabelUrl: null,
            couponCode: appliedCouponCode,
            discountAmount: discountAmount.toFixed(2),
            notes: orderNotes,
          })
          .returning();
        return newOrder;
      });
    } catch (err: any) {
      if (err?.name === "InsufficientStockError") {
        res.status(409).json({ error: "OUT_OF_STOCK", message: "Um dos itens selecionados está sem estoque disponível. Remova-o do carrinho e tente novamente." });
        return;
      }
      throw err;
    }

    console.log(`[Checkout] Order ${order.id} created: shippingAddress=${address ? 'yes' : 'no'}, shippingServiceId=${shippingOption?.melhorEnvioId ?? 'none'}`);

    const uniqueProductIds = Array.from(new Set(cartItemsList.map((i) => i.productId)));
    const productResults = await Promise.all(uniqueProductIds.map((id) => storage.getProductById(id)));
    const prodMap = new Map(productResults.filter(Boolean).map((p) => [p!.id, p!.name]));

    const orderItemsData = cartItemsList.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: prodMap.get(item.productId) ?? "Produto Gráfica",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
      specifications: item.specifications,
      artFileUrl: item.artFileUrl,
      artStatus: item.artFileUrl ? "uploaded" as const : "pending" as const,
    }));

    await storage.addOrderItems(orderItemsData);

    const paymentMode = process.env.PAYMENT_MODE || "mercadopago";

    if (paymentMode === "whatsapp") {
      await storage.clearCart(sessionId);

      const itemsSummary = orderItemsData.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        subtotal: parseFloat(item.subtotal),
      }));

      res.status(201).json({
        paymentMode: "whatsapp",
        orderId: order.id,
        customerName: customerName || "Cliente",
        itemsSummary,
        subtotal,
        discountAmount,
        couponCode: appliedCouponCode,
        shippingCost,
        shippingService: shippingOption ? `${shippingOption.carrier} - ${shippingOption.service}` : null,
        total,
        address: address || null,
        whatsappNumber: process.env.WHATSAPP_NUMBER || "",
      });
      return;
    }

    try {
      const preferenceItems = cartItemsList.map((item) => ({
        id: item.productId,
        title: prodMap.get(item.productId) ?? "Produto Gráfica",
        quantity: item.quantity,
        unit_price: parseFloat(parseFloat(item.unitPrice).toFixed(2)),
      }));

      const preference = await createPreference({
        orderId: order.id,
        items: preferenceItems,
        shippingCost,
        discountAmount,
        payer: {
          name: customerName || "Cliente",
          email: customerEmail || "guest@kairos.com.br",
          phone: customerPhone,
        },
      });

      await storage.updatePaymentStatus(order.id, "pending", preference.preferenceId);

      res.status(201).json({
        orderId: order.id,
        total,
        preferenceId: preference.preferenceId,
        initPoint: preference.initPoint,
        sandboxInitPoint: preference.sandboxInitPoint,
      });
    } catch (err: any) {
      console.error("[Checkout] MercadoPago preference creation failed:");
      console.error("  message:", err?.message);
      console.error("  status:", err?.status);
      console.error("  cause:", JSON.stringify(err?.cause ?? err, null, 2));
      res.status(201).json({
        orderId: order.id,
        total,
        paymentError: "Erro ao criar preferência de pagamento. Tente novamente.",
      });
    }
  });

  // ── Upload ──

  const ALLOWED_MIMES = [
    "application/pdf",
    "image/jpeg", "image/png", "image/tiff",
    "application/postscript",
    "application/illustrator",
    "application/eps",
  ];
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIMES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Formato não suportado. Envie PDF, JPG, PNG, TIFF, AI ou EPS."));
      }
    },
  });

  app.post("/api/grafica/upload", requireAuth, upload.single("file"), async (req, res) => {
    const { orderItemId } = req.body;

    if (!req.file) {
      res.status(400).json({ message: "Nenhum arquivo enviado" });
      return;
    }

    if (!orderItemId) {
      res.status(400).json({ message: "orderItemId é obrigatório" });
      return;
    }

    const orderItem = await storage.getOrderItemById(orderItemId);
    if (!orderItem) {
      res.status(404).json({ message: "Item do pedido não encontrado" });
      return;
    }

    try {
      const url = await uploadArtFile({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
        orderId: orderItem.orderId,
        orderItemId,
      });

      await storage.updateOrderItemArt(orderItemId, url, "uploaded");

      res.json({
        uploadUrl: url,
        fileId: randomUUID(),
        status: "accepted",
      });
    } catch (err: any) {
      console.error("[Upload] Error:", err?.message || err);
      res.status(500).json({ message: err?.message || "Erro ao fazer upload do arquivo" });
    }
  });

  // ── Coupon Validation ──

  app.post("/api/grafica/coupons/validate", async (req, res) => {
    const { code, subtotal } = req.body;
    if (!code || typeof code !== "string") {
      res.status(400).json({ valid: false, message: "Código do cupom é obrigatório" });
      return;
    }

    const coupon = await storage.getCouponByCode(code);
    if (!coupon || !coupon.active) {
      res.json({ valid: false, message: "Cupom não encontrado ou inativo" });
      return;
    }

    const now = new Date();
    if (now < new Date(coupon.validFrom) || now > new Date(coupon.validTo)) {
      res.json({ valid: false, message: "Cupom fora do período de validade" });
      return;
    }

    if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
      res.json({ valid: false, message: "Cupom atingiu o limite de usos" });
      return;
    }

    const orderSubtotal = parseFloat(subtotal) || 0;
    if (orderSubtotal < parseFloat(coupon.minOrderAmount)) {
      res.json({ valid: false, message: `Pedido mínimo de R$ ${parseFloat(coupon.minOrderAmount).toFixed(2)}` });
      return;
    }

    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = orderSubtotal * parseFloat(coupon.discountValue) / 100;
    } else {
      discountAmount = parseFloat(coupon.discountValue);
    }
    discountAmount = Math.min(discountAmount, orderSubtotal);

    res.json({
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      message: coupon.discountType === "percentage"
        ? `${parseFloat(coupon.discountValue)}% de desconto aplicado!`
        : `Desconto de R$ ${parseFloat(coupon.discountValue).toFixed(2)} aplicado!`,
    });
  });

  // ── Tracking ──

  app.get("/api/grafica/orders/:id/tracking", requireAuth, async (req, res) => {
    const order = await storage.getOrder(req.params.id as string);
    if (!order) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }

    if (order.customerId !== req.customerId) {
      res.status(403).json({ message: "Acesso negado" });
      return;
    }

    if (!order.shippingTrackingCode) {
      res.json({ trackingCode: null, events: [] });
      return;
    }

    const events = await getTrackingInfo(order.shippingTrackingCode);
    res.json({ trackingCode: order.shippingTrackingCode, events });
  });

  // ── Cancel Order (Customer) ──

  app.post("/api/grafica/orders/:id/cancel", requireAuth, async (req, res) => {
    const order = await storage.getOrder(req.params.id as string);
    if (!order) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }

    if (order.customerId !== req.customerId) {
      res.status(403).json({ message: "Acesso negado" });
      return;
    }

    if (!["pending", "confirmed"].includes(order.status)) {
      res.status(400).json({ message: "Este pedido não pode mais ser cancelado" });
      return;
    }

    await storage.updateOrderStatus(order.id, "cancelled");

    if (order.paymentStatus === "approved" && order.paymentExternalId) {
      createRefund(order.paymentExternalId)
        .then(() => storage.updatePaymentStatus(order.id, "refunded"))
        .catch((err) => console.error(`[Cancel] Refund failed for order ${order.id}:`, err?.message));
    }

    triggerOrderEmail(order.id, "cancelled").catch(() => {});

    res.json({ message: "Pedido cancelado com sucesso" });
  });

  // ── Account (Customer) ──

  app.get("/api/grafica/account/orders", requireAuth, async (req, res) => {
    const orders = await storage.getOrdersByCustomer(req.customerId!);
    res.json(orders);
  });

  // ── Account: Addresses ──

  app.get("/api/grafica/account/addresses", requireAuth, async (req, res) => {
    const addresses = await storage.getAddressesByCustomer(req.customerId!);
    res.json(addresses);
  });

  app.post("/api/grafica/account/addresses", requireAuth, validate(createAddressSchema), async (req, res) => {
    const address = await storage.createAddress({
      ...req.body,
      customerId: req.customerId!,
    });
    res.status(201).json(address);
  });

  app.patch("/api/grafica/account/addresses/:id", requireAuth, validate(updateAddressSchema), async (req, res) => {
    const addrId = req.params.id as string;
    const existing = await storage.getAddress(addrId);
    if (!existing || existing.customerId !== req.customerId!) {
      res.status(404).json({ message: "Endereço não encontrado" });
      return;
    }
    const updated = await storage.updateAddress(addrId, req.body);
    res.json(updated);
  });

  app.delete("/api/grafica/account/addresses/:id", requireAuth, async (req, res) => {
    const addrId = req.params.id as string;
    const existing = await storage.getAddress(addrId);
    if (!existing || existing.customerId !== req.customerId!) {
      res.status(404).json({ message: "Endereço não encontrado" });
      return;
    }
    await storage.deleteAddress(addrId);
    res.status(204).send();
  });

  // ── Account: Profile ──

  app.patch("/api/grafica/account/profile", requireAuth, validate(updateProfileSchema), async (req, res) => {
    const updated = await storage.updateCustomer(req.customerId!, req.body);
    if (!updated) {
      res.status(404).json({ message: "Cliente não encontrado" });
      return;
    }
    res.json({ id: updated.id, name: updated.name, email: updated.email, phone: updated.phone });
  });

  app.post("/api/grafica/account/change-password", requireAuth, validate(changePasswordSchema), async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const customer = await storage.getCustomer(req.customerId!);
    if (!customer) {
      res.status(404).json({ message: "Cliente não encontrado" });
      return;
    }
    const valid = await verifyPassword(currentPassword, customer.passwordHash);
    if (!valid) {
      res.status(400).json({ message: "Senha atual incorreta" });
      return;
    }
    const newHash = await hashPassword(newPassword);
    await storage.updateCustomer(req.customerId!, { passwordHash: newHash });
    res.json({ message: "Senha alterada com sucesso" });
  });

  // ── Payment Status Check ──

  app.get("/api/grafica/orders/:id/payment-status", requireAuth, async (req, res) => {
    const order = await storage.getOrder(req.params.id as string);
    if (!order) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }
    if (order.customerId !== req.customerId) {
      res.status(403).json({ message: "Acesso negado" });
      return;
    }
    res.json({
      orderId: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
    });
  });

  // ── Verify Payment (active check when user returns from MP) ──

  app.post("/api/grafica/orders/:id/verify-payment", requireAuth, async (req, res) => {
    const orderId = req.params.id as string;
    const { paymentId } = req.body;

    const order = await storage.getOrder(orderId);
    if (!order) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }

    if (order.customerId !== req.customerId) {
      res.status(403).json({ message: "Acesso negado" });
      return;
    }

    if (order.paymentStatus === "approved") {
      res.json({
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        updated: false,
      });
      return;
    }

    if (!paymentId) {
      res.json({
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        updated: false,
      });
      return;
    }

    try {
      const payment = await getPayment(String(paymentId));
      console.log(`[VerifyPayment] Order ${orderId}: MP payment ${paymentId} status=${payment.status}`);

      if (payment.externalReference !== orderId) {
        console.warn(`[VerifyPayment] Payment ${paymentId} ref=${payment.externalReference} does not match order ${orderId}`);
        res.status(400).json({ message: "Pagamento não corresponde ao pedido" });
        return;
      }

      const { orderStatus, paymentStatus } = mapPaymentStatus(payment.status);

      if (order.paymentStatus !== paymentStatus) {
        await storage.updatePaymentStatus(orderId, paymentStatus, String(paymentId));
        await storage.updateOrderStatus(orderId, orderStatus);
        console.log(`[VerifyPayment] Order ${orderId} updated: status=${orderStatus}, payment=${paymentStatus}`);

        if (paymentStatus === "approved" && order.notes) {
          const sessionMatch = order.notes.match(/__sessionId:(\S+)/);
          if (sessionMatch) {
            await storage.clearCart(sessionMatch[1]);
          }
        }

        if (paymentStatus === "approved") {
          autoGenerateLabel(orderId).catch(() => {});
        }

        triggerOrderEmail(orderId, orderStatus).catch(() => {});
      }

      res.json({
        orderId: order.id,
        status: orderStatus,
        paymentStatus,
        updated: order.paymentStatus !== paymentStatus,
      });
    } catch (err: any) {
      console.error(`[VerifyPayment] Error verifying payment ${paymentId}:`, err?.message || err);
      res.json({
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        updated: false,
        error: "Não foi possível verificar o pagamento",
      });
    }
  });

  // ── Webhook: MercadoPago ──

  app.post("/api/webhooks/mercadopago", async (req, res) => {
    try {
      const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
      if (webhookSecret) {
        const xSignature = req.headers["x-signature"] as string | undefined;
        const xRequestId = req.headers["x-request-id"] as string | undefined;
        const dataId = req.query["data.id"] || req.body?.data?.id || "";

        if (!xSignature) {
          console.warn("[Webhook] Missing x-signature header");
          res.status(401).json({ message: "Assinatura ausente" });
          return;
        }

        const parts = Object.fromEntries(
          xSignature.split(",").map((p) => {
            const [k, ...v] = p.split("=");
            return [k.trim(), v.join("=")];
          }),
        );
        const ts = parts["ts"];
        const v1 = parts["v1"];

        if (!ts || !v1) {
          console.warn("[Webhook] Invalid x-signature format");
          res.status(401).json({ message: "Formato de assinatura inválido" });
          return;
        }

        const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
        const computed = createHmac("sha256", webhookSecret).update(template).digest("hex");

        try {
          const valid = timingSafeEqual(Buffer.from(computed), Buffer.from(v1));
          if (!valid) {
            console.warn("[Webhook] Signature mismatch");
            res.status(401).json({ message: "Assinatura inválida" });
            return;
          }
        } catch {
          console.warn("[Webhook] Signature comparison failed");
          res.status(401).json({ message: "Assinatura inválida" });
          return;
        }
      } else if (process.env.NODE_ENV === "production") {
        console.error("[Webhook] MERCADOPAGO_WEBHOOK_SECRET not set in production — rejecting request");
        res.status(500).json({ message: "Webhook não configurado" });
        return;
      } else {
        console.warn("[Webhook] MERCADOPAGO_WEBHOOK_SECRET not set — skipping signature validation (dev only)");
      }

      const { type, data } = req.body;

      if (type !== "payment" || !data?.id) {
        res.status(200).json({ received: true, processed: false });
        return;
      }

      const paymentId = String(data.id);
      console.log(`[Webhook] Payment notification received: ${paymentId}`);

      const payment = await getPayment(paymentId);
      console.log(`[Webhook] Payment ${paymentId}: status=${payment.status}, ref=${payment.externalReference}`);

      if (!payment.externalReference) {
        console.warn(`[Webhook] Payment ${paymentId} has no external_reference, skipping.`);
        res.status(200).json({ received: true, processed: false });
        return;
      }

      const orderId = payment.externalReference;
      const order = await storage.getOrder(orderId);

      if (!order) {
        console.warn(`[Webhook] Order ${orderId} not found for payment ${paymentId}`);
        res.status(200).json({ received: true, processed: false });
        return;
      }

      const { orderStatus, paymentStatus } = mapPaymentStatus(payment.status);
      mapPaymentMethod(payment.paymentTypeId);

      if (order.paymentStatus !== paymentStatus) {
        await storage.updatePaymentStatus(orderId, paymentStatus, paymentId);
        await storage.updateOrderStatus(orderId, orderStatus);
        console.log(`[Webhook] Order ${orderId} updated: status=${orderStatus}, payment=${paymentStatus}`);

        // Extract session from order notes for stock + cart management
        const sessionMatch = order.notes?.match(/__sessionId:(\S+)/);
        const sessionId = sessionMatch?.[1];

        if (paymentStatus === "approved") {
          // Confirm stock reservations (prevents cron from releasing them)
          if (sessionId) {
            confirmReservations(sessionId).catch((e) =>
              console.error(`[Webhook] Failed to confirm reservations for session ${sessionId}:`, e?.message),
            );
            await storage.clearCart(sessionId);
            console.log(`[Webhook] Cart cleared for session ${sessionId}`);
          }
          autoGenerateLabel(orderId).catch(() => {});
        } else if (paymentStatus === "rejected" || paymentStatus === "cancelled" || orderStatus === "cancelled") {
          // Release stock reservations immediately
          if (sessionId) {
            releaseOrderReservations(sessionId).catch((e) =>
              console.error(`[Webhook] Failed to release reservations for session ${sessionId}:`, e?.message),
            );
          }
        }

        triggerOrderEmail(orderId, orderStatus).catch(() => {});
      }

      res.status(200).json({ received: true, processed: true });
    } catch (err: any) {
      console.error("[Webhook] Error processing notification:", err?.message || err);
      res.status(200).json({ received: true, error: true });
    }
  });
}
