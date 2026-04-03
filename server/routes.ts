import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { registerGraficaRoutes } from "./routes/grafica";
import { registerAdminRoutes } from "./routes/admin";

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

  // ── Domain Route Modules ──

  registerGraficaRoutes(app);
  registerAdminRoutes(app);

  return httpServer;
}
