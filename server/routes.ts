import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { registerGraficaRoutes } from "./routes/grafica";
import { registerAdminRoutes } from "./routes/admin";
import { confirmReservations, releaseOrderReservations } from "./services/stock-reservation";
import { calculateShipping, calculatePackage, getMelhorEnvioStatus } from "./services/shipping";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Health Check ──

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── SEO: Sitemap & Robots ──

  const siteUrl = (process.env.SITE_URL || "https://kairos.com.br").trim().replace(/\s+/g, "");

  app.get("/sitemap.xml", async (_req, res) => {
    const cats = await storage.getCategories();
    const allProducts: { slug: string }[] = [];
    for (const cat of cats) {
      const prods = await storage.getProductsByCategory(cat.id);
      for (const p of prods) allProducts.push({ slug: p.slug });
    }

    const urls = [
      `<url><loc>${siteUrl}/grafica</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
      `<url><loc>${siteUrl}/grafica/faq</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
      `<url><loc>${siteUrl}/grafica/termos</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
      `<url><loc>${siteUrl}/grafica/privacidade</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
      ...cats.map((c) => `<url><loc>${siteUrl}/grafica/${c.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
      ...allProducts.map((p) => `<url><loc>${siteUrl}/grafica/produto/${p.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`),
    ];

    res.header("Content-Type", "application/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`);
  });

  app.get("/robots.txt", (_req, res) => {
    res.header("Content-Type", "text/plain");
    res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml
`);
  });

  // ── Payment Mode Config ──

  app.get("/api/config/payment-mode", (_req, res) => {
    res.json({
      mode: process.env.PAYMENT_MODE || "mercadopago",
      whatsappNumber: process.env.WHATSAPP_NUMBER || "",
    });
  });

  // ── Estratégia de Conteúdo (public) ──

  app.get("/api/estrategia/plans", async (_req, res) => {
    const plans = await storage.getActiveEstrategiaPlans();
    res.json(plans);
  });

  app.get("/api/estrategia/steps", async (_req, res) => {
    const steps = await storage.getAllEstrategiaSteps();
    res.json(steps);
  });

  // ── DEV ONLY: Fake Payment Simulator ──
  // Simulates MercadoPago webhook logic without real MP calls.
  // Disabled automatically in production.

  if (process.env.NODE_ENV !== "production") {
    app.get("/api/dev/orders", async (_req, res) => {
      try {
        const orders = await storage.getAllOrders();
        res.json(orders.slice(0, 20).map((o) => ({
          id: o.id,
          status: o.status,
          paymentStatus: o.paymentStatus,
          total: o.total,
          createdAt: o.createdAt,
          notes: o.notes,
        })));
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    app.post("/api/dev/simulate-payment", async (req, res) => {
      const { orderId, action } = req.body as { orderId: string; action: "approve" | "reject" | "cancel" };

      if (!orderId || !["approve", "reject", "cancel"].includes(action)) {
        res.status(400).json({ error: "Forneça orderId e action (approve | reject | cancel)" });
        return;
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        res.status(404).json({ error: "Pedido não encontrado" });
        return;
      }

      const sessionMatch = order.notes?.match(/__sessionId:(\S+)/);
      const sessionId = sessionMatch?.[1];

      if (action === "approve") {
        await storage.updatePaymentStatus(orderId, "approved", `fake_payment_${Date.now()}`);
        await storage.updateOrderStatus(orderId, "confirmed");
        if (sessionId) {
          await confirmReservations(sessionId);
          await storage.clearCart(sessionId);
        }
        res.json({ ok: true, message: `Pedido ${orderId} aprovado. Estoque confirmado.`, sessionId });
      } else {
        const paymentStatus = action === "reject" ? "rejected" : "cancelled";
        const orderStatus = "cancelled";
        await storage.updatePaymentStatus(orderId, paymentStatus, `fake_payment_${Date.now()}`);
        await storage.updateOrderStatus(orderId, orderStatus);
        if (sessionId) {
          await releaseOrderReservations(sessionId);
        }
        res.json({ ok: true, message: `Pedido ${orderId} ${action === "reject" ? "rejeitado" : "cancelado"}. Estoque liberado.`, sessionId });
      }
    });

    console.log("[DEV] Fake payment simulator disponível em /api/dev/simulate-payment");

    // ── DEV: Melhor Envio Sandbox Tools ──

    // In-memory token store for dev session (persists until server restart)
    let devSandboxToken: string | null = process.env.MELHOR_ENVIO_SANDBOX_TOKEN || null;
    let devSandboxRefreshToken: string | null = null;
    let devPkceVerifier: string | null = null;
    const ME_SANDBOX_BASE = "https://sandbox.melhorenvio.com.br";

    const { createHash, randomBytes } = await import("crypto");
    function generatePkce() {
      const verifier = randomBytes(32).toString("base64url");
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      return { verifier, challenge };
    }

    app.get("/api/dev/shipping/status", (_req, res) => {
      const status = getMelhorEnvioStatus();
      res.json({
        ...status,
        devSessionToken: devSandboxToken ? `${devSandboxToken.substring(0, 12)}...` : null,
      });
    });

    // Step 1: Generate the ME authorization URL (with PKCE)
    app.get("/api/dev/shipping/oauth/url", (req, res) => {
      const clientId = (req.query.clientId as string) || process.env.MELHOR_ENVIO_CLIENT_ID || "";
      const callbackUrl = (req.query.redirectUri as string) || process.env.MELHOR_ENVIO_CALLBACK_URL || "https://kairos.com.br/api/oauth/callback";
      if (!clientId) {
        res.status(400).json({ error: "Forneça o Client ID do aplicativo" });
        return;
      }
      const { verifier, challenge } = generatePkce();
      devPkceVerifier = verifier;
      const scopes = [
        "shipping-calculate",
        "cart-read", "cart-write",
        "shipping-checkout", "shipping-generate", "shipping-print", "shipping-tracking",
      ].join(" ");
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        response_type: "code",
        scope: scopes,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      const url = `${ME_SANDBOX_BASE}/oauth/authorize?${params.toString()}`;
      console.log("[DEV][OAuth] Auth URL gerada com PKCE. Verifier salvo em memória.");
      res.json({ url, callbackUrl });
    });

    // Step 1b: Password grant (simpler for dev — no redirect needed)
    app.post("/api/dev/shipping/oauth/password", async (req, res) => {
      const { clientId: bodyClientId, clientSecret: bodyClientSecret, email, password } = req.body as { clientId?: string; clientSecret?: string; email?: string; password?: string };
      const clientId = bodyClientId || process.env.MELHOR_ENVIO_CLIENT_ID || "";
      const clientSecret = bodyClientSecret || process.env.MELHOR_ENVIO_CLIENT_SECRET || "";
      if (!clientId || !clientSecret || !email || !password) {
        res.status(400).json({ error: "Forneça clientId, clientSecret, email e password" });
        return;
      }
      const scopes = "shipping-calculate cart-read cart-write shipping-checkout shipping-generate shipping-print shipping-tracking";
      try {
        const response = await fetch(`${ME_SANDBOX_BASE}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json", "User-Agent": "Kairos Grafica (contato@kairos.com.br)" },
          body: new URLSearchParams({ grant_type: "password", client_id: clientId, client_secret: clientSecret, username: email, password, scope: scopes }).toString(),
        });
        const data = await response.json() as any;
        console.log("[DEV][OAuth] Password grant resposta:", response.status, JSON.stringify(data));
        if (!response.ok || data.error) {
          res.status(400).json({ error: data.error_description || data.error || "Falha no login", detail: data });
          return;
        }
        devSandboxToken = data.access_token;
        devSandboxRefreshToken = data.refresh_token;
        res.json({ ok: true, access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // Step 2: Exchange authorization code for access token
    app.post("/api/dev/shipping/oauth/exchange", async (req, res) => {
      const { code, clientId: bodyClientId, clientSecret: bodyClientSecret, redirectUri: bodyRedirectUri } = req.body as { code?: string; clientId?: string; clientSecret?: string; redirectUri?: string };
      if (!code) {
        res.status(400).json({ error: "Forneça o code da URL de redirect" });
        return;
      }
      const clientId = bodyClientId || process.env.MELHOR_ENVIO_CLIENT_ID || "";
      const clientSecret = bodyClientSecret || process.env.MELHOR_ENVIO_CLIENT_SECRET || "";
      const callbackUrl = bodyRedirectUri || process.env.MELHOR_ENVIO_CALLBACK_URL || "https://kairos.com.br/api/oauth/callback";
      if (!clientId || !clientSecret) {
        res.status(400).json({ error: "Forneça o Client ID e Client Secret do aplicativo" });
        return;
      }
      const payload: Record<string, string> = {
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        code,
      };
      if (devPkceVerifier) {
        payload.code_verifier = devPkceVerifier;
        console.log("[DEV][OAuth] Incluindo code_verifier PKCE na troca.");
      } else {
        console.warn("[DEV][OAuth] AVISO: code_verifier não encontrado em memória. Reinicie e refaça o fluxo completo.");
      }
      console.log("[DEV][OAuth] Enviando para ME:", JSON.stringify({ ...payload, client_secret: "***", code: code.substring(0, 12) + "..." }));
      try {
        const formBody = new URLSearchParams(payload as any).toString();
        const response = await fetch(`${ME_SANDBOX_BASE}/oauth/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "Kairos Grafica (contato@kairos.com.br)",
          },
          body: formBody,
        });
        const data = await response.json() as any;
        console.log("[DEV][OAuth] Resposta ME:", response.status, JSON.stringify(data));
        if (!response.ok || data.error) {
          res.status(400).json({ error: data.error_description || data.error || "Falha na troca do token", detail: data });
          return;
        }
        devSandboxToken = data.access_token;
        devSandboxRefreshToken = data.refresh_token;
        console.log("[DEV] Melhor Envio sandbox token obtido e salvo em memória");
        res.json({
          ok: true,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
          message: "Token salvo em memória. Adicione ao .env como MELHOR_ENVIO_SANDBOX_TOKEN para persistir entre reinicializações.",
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    // Step 3: Refresh token
    app.post("/api/dev/shipping/oauth/refresh", async (req, res) => {
      const refreshToken = (req.body as any).refresh_token || devSandboxRefreshToken;
      const clientId = process.env.MELHOR_ENVIO_CLIENT_ID || "";
      const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET || "";
      if (!refreshToken || !clientId || !clientSecret) {
        res.status(400).json({ error: "Refresh token ou credenciais não disponíveis" });
        return;
      }
      try {
        const response = await fetch(`${ME_SANDBOX_BASE}/oauth/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "Kairos Grafica (contato@kairos.com.br)",
          },
          body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }).toString(),
        });
        const data = await response.json() as any;
        if (!response.ok || data.error) {
          res.status(400).json({ error: data.error_description || data.error });
          return;
        }
        devSandboxToken = data.access_token;
        devSandboxRefreshToken = data.refresh_token;
        res.json({ ok: true, access_token: data.access_token, expires_in: data.expires_in });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    app.post("/api/dev/shipping/calculate", async (req, res) => {
      const { cepDestino } = req.body as { cepDestino?: string };
      if (!cepDestino) {
        res.status(400).json({ error: "Forneça cepDestino" });
        return;
      }
      try {
        const quotes = await calculateShipping({
          destinationCep: cepDestino.replace(/\D/g, ""),
          items: [],
          overrideToken: devSandboxToken || undefined,
          overrideBaseUrl: devSandboxToken ? ME_SANDBOX_BASE : undefined,
        });
        res.json({ quotes, status: getMelhorEnvioStatus() });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    console.log("[DEV] Melhor Envio sandbox tools disponíveis em /api/dev/shipping/*");
  }

  // ── Domain Route Modules ──

  registerGraficaRoutes(app);
  registerAdminRoutes(app);

  return httpServer;
}
