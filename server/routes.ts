import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import type { CategoryWithCount, CategoryWithProducts, ProductWithDetails } from "../shared/types";
import {
  validate, addCartItemSchema, updateCartItemSchema,
  checkoutSchema, updateStatusSchema,
  registerSchema, loginSchema,
} from "./middleware/validate";
import { requireAuth, optionalAuth } from "./middleware/auth";
import { hashPassword, verifyPassword, generateToken } from "./services/auth";
import {
  createPreference, getPayment,
  mapPaymentStatus, mapPaymentMethod,
} from "./services/mercadopago";
import {
  calculateShipping,
  addToMelhorEnvioCart, checkoutShipment, generateLabel, getLabelUrl,
  calculatePackage,
} from "./services/shipping";
import { registerAdminRoutes } from "./routes/admin";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ── Gráfica: Categories ──

  app.get("/api/grafica/categories", async (_req, res) => {
    const categories = await storage.getCategories();
    const result: CategoryWithCount[] = await Promise.all(
      categories.map(async (cat) => {
        const products = await storage.getProductsByCategory(cat.id);
        return { ...cat, productCount: products.length };
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

    const category = (await storage.getCategories()).find(
      (c) => c.id === product.categoryId,
    );
    if (!category) {
      res.status(404).json({ message: "Categoria do produto não encontrada" });
      return;
    }

    const variants = await storage.getProductVariants(product.id);
    const priceRules = await storage.getPriceRules(product.id);
    const allPapers = await storage.getPaperTypes();
    const allFinishings = await storage.getFinishings();

    const usedPaperIds = new Set(variants.map((v) => v.paperTypeId));
    const usedFinishingIds = new Set(
      variants.map((v) => v.finishingId).filter(Boolean),
    );

    const prices = priceRules.map((r) => parseFloat(r.pricePerUnit));
    const priceRange = prices.length > 0
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : { min: parseFloat(product.basePrice), max: parseFloat(product.basePrice) };

    const result: ProductWithDetails = {
      ...product,
      category,
      variants,
      availablePapers: allPapers.filter((p) => usedPaperIds.has(p.id)),
      availableFinishings: allFinishings.filter((f) => usedFinishingIds.has(f.id)),
      priceRange,
      priceRules,
    };
    res.json(result);
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
    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const allCategories = await storage.getCategories();
        const allProductArrays = await Promise.all(
          allCategories.map((c) => storage.getProductsByCategory(c.id)),
        );
        const allProducts = allProductArrays.flat();
        const product = allProducts.find((p) => p.id === item.productId);
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

  app.post("/api/grafica/orders", async (req, res) => {
    const order = await storage.createOrder(req.body);
    if (req.body.items) {
      const orderItemsToInsert = req.body.items.map((item: any) => ({
        ...item,
        orderId: order.id,
      }));
      await storage.addOrderItems(orderItemsToInsert);
    }
    res.status(201).json(order);
  });

  app.get("/api/grafica/orders/:id", async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }
    const items = await storage.getOrderItems(order.id);
    res.json({ ...order, items });
  });

  app.patch("/api/grafica/orders/:id/status", validate(updateStatusSchema), async (req, res) => {
    const { status } = req.body;
    const updated = await storage.updateOrderStatus(req.params.id as string, status);
    if (!updated) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }
    res.json(updated);
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
      // Resolve cart items for package calculation
      const items = sessionId ? await storage.getCartItems(sessionId) : [];

      const quotes = await calculateShipping({
        destinationCep: cleanCep,
        items,
      });

      res.json(quotes);
    } catch (err: any) {
      console.error("[Shipping] Quote error:", err?.message || err);
      // Fallback: never block checkout
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

  app.post("/api/grafica/auth/register", validate(registerSchema), async (req, res) => {
    const { name, email, phone, password } = req.body;

    const existing = await storage.getCustomerByEmail(email);
    if (existing) {
      res.status(409).json({ message: "E-mail já cadastrado" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const customer = await storage.createCustomer({ name, email, phone: phone || null, passwordHash });
    const token = generateToken(customer.id);

    res.status(201).json({
      token,
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    });
  });

  app.post("/api/grafica/auth/login", validate(loginSchema), async (req, res) => {
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

  app.post("/api/grafica/checkout", requireAuth, validate(checkoutSchema), async (req, res) => {
    const { sessionId, customerName, customerEmail, customerPhone, address, shippingOption, notes } = req.body;

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
    const total = subtotal + shippingCost;

    // Store sessionId in notes so webhook can clear cart after payment approval
    const orderNotes = [notes, `__sessionId:${sessionId}`].filter(Boolean).join("\n");

    const order = await storage.createOrder({
      customerId: req.customerId!,
      status: "pending",
      addressId: null,
      subtotal: subtotal.toFixed(2),
      shippingCost: shippingCost.toFixed(2),
      total: total.toFixed(2),
      paymentMethod: "mercadopago",
      paymentStatus: "pending",
      paymentExternalId: null,
      mpPreferenceId: null,
      shippingTrackingCode: null,
      notes: orderNotes,
    });

    // Resolve product names
    const allCats = await storage.getCategories();
    const allProdArrays = await Promise.all(allCats.map((c) => storage.getProductsByCategory(c.id)));
    const allProds = allProdArrays.flat();
    const prodMap = new Map(allProds.map((p) => [p.id, p.name]));

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
    // Cart is NOT cleared here — it will be cleared in the webhook when payment is approved

    // Create MercadoPago Checkout Pro preference
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
        payer: {
          name: customerName || "Cliente",
          email: customerEmail || "guest@kairos.com.br",
          phone: customerPhone,
        },
      });

      // Store the preference ID on the order
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
      // Order is created but payment preference failed — return order info with error
      res.status(201).json({
        orderId: order.id,
        total,
        paymentError: "Erro ao criar preferência de pagamento. Tente novamente.",
      });
    }
  });

  // ── Upload ──

  app.post("/api/grafica/upload", async (req, res) => {
    const { orderItemId, fileName } = req.body;
    const fakeUrl = `/uploads/${Date.now()}-${fileName}`;

    if (orderItemId) {
      await storage.updateOrderItemArt(orderItemId, fakeUrl, "uploaded");
    }

    res.json({
      uploadUrl: fakeUrl,
      fileId: randomUUID(),
      status: "accepted",
      validation: { dpiOk: true, dimensionsOk: true, colorSpaceOk: true, messages: [] },
    });
  });

  // ── Account (Customer) ──

  app.get("/api/grafica/account/orders", requireAuth, async (req, res) => {
    const orders = await storage.getOrdersByCustomer(req.customerId!);
    res.json(orders);
  });

  // ── Admin Routes (protected, in separate file) ──
  registerAdminRoutes(app);

  // ── Webhook: MercadoPago ──
  // Official docs: https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
  // MP sends POST with { type, action, data: { id } }
  // IMPORTANT: Always fetch payment from API — never trust webhook body directly.

  app.post("/api/webhooks/mercadopago", async (req, res) => {
    try {
      const { type, data } = req.body;

      // Only process payment notifications
      if (type !== "payment" || !data?.id) {
        res.status(200).json({ received: true, processed: false });
        return;
      }

      const paymentId = String(data.id);
      console.log(`[Webhook] Payment notification received: ${paymentId}`);

      // Fetch payment details from MercadoPago API (single source of truth)
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

      // Map MP status to our internal statuses
      const { orderStatus, paymentStatus } = mapPaymentStatus(payment.status);
      const resolvedPaymentMethod = mapPaymentMethod(payment.paymentTypeId);

      // Update order — idempotent: only update if status actually changed
      if (order.paymentStatus !== paymentStatus) {
        await storage.updatePaymentStatus(orderId, paymentStatus, paymentId);
        await storage.updateOrderStatus(orderId, orderStatus);
        console.log(`[Webhook] Order ${orderId} updated: status=${orderStatus}, payment=${paymentStatus}, method=${resolvedPaymentMethod}`);

        // Clear cart when payment is approved
        if (paymentStatus === "approved" && order.notes) {
          const sessionMatch = order.notes.match(/__sessionId:(\S+)/);
          if (sessionMatch) {
            await storage.clearCart(sessionMatch[1]);
            console.log(`[Webhook] Cart cleared for session ${sessionMatch[1]}`);
          }
        }
      }

      res.status(200).json({ received: true, processed: true });
    } catch (err: any) {
      console.error("[Webhook] Error processing notification:", err?.message || err);
      // Return 200 to avoid MP retrying on server errors
      // (we log the error and can investigate later)
      res.status(200).json({ received: true, error: true });
    }
  });

  // ── Payment Status Check ──
  // Frontend can poll this after returning from MercadoPago

  app.get("/api/grafica/orders/:id/payment-status", async (req, res) => {
    const order = await storage.getOrder(req.params.id as string);
    if (!order) {
      res.status(404).json({ message: "Pedido não encontrado" });
      return;
    }
    res.json({
      orderId: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
    });
  });

  return httpServer;
}
