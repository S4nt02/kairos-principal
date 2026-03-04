/**
 * Seed script for the Gráfica Kairós product catalog.
 *
 * Usage:
 *   npx tsx scripts/seed-products.ts
 *
 * Requires DATABASE_URL in .env
 */

import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import {
  categories, products, paperTypes, finishings,
  productVariants, priceRules, orderItems, orders, cartItems,
} from "../shared/schema";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ── Stable IDs (deterministic for re-runs) ──
const CAT_PANFLETOS = "cat-panfletos";
const CAT_CARTOES = "cat-cartoes";
const CAT_BANNERS = "cat-banners";
const CAT_FOLDERS = "cat-folders";
const CAT_ADESIVOS = "cat-adesivos";
const CAT_CARDAPIOS = "cat-cardapios";

const PAPER_COUCHE_90 = "paper-couche-90";
const PAPER_COUCHE_115 = "paper-couche-115";
const PAPER_COUCHE_150 = "paper-couche-150";
const PAPER_COUCHE_250 = "paper-couche-250";
const PAPER_OFFSET_75 = "paper-offset-75";
const PAPER_KRAFT_120 = "paper-kraft-120";

const FIN_LAM_FOSCA = "fin-lam-fosca";
const FIN_LAM_BRILHO = "fin-lam-brilho";
const FIN_VERNIZ_TOTAL = "fin-verniz-total";
const FIN_VERNIZ_LOCAL = "fin-verniz-local";
const FIN_REFILE = "fin-refile";
const FIN_DOBRA = "fin-dobra";
const FIN_CORTE_ESP = "fin-corte-esp";

const PROD_PANFLETO_A5 = "prod-panfleto-a5";
const PROD_PANFLETO_A4 = "prod-panfleto-a4";
const PROD_PANFLETO_A3 = "prod-panfleto-a3";
const PROD_CARTAO_PADRAO = "prod-cartao-padrao";
const PROD_CARTAO_MINI = "prod-cartao-mini";
const PROD_CARTAO_VERNIZ = "prod-cartao-verniz";
const PROD_BANNER_60X90 = "prod-banner-60x90";
const PROD_BANNER_80X120 = "prod-banner-80x120";
const PROD_FOLDER_2DOBRAS = "prod-folder-2dobras";
const PROD_FOLDER_3DOBRAS = "prod-folder-3dobras";
const PROD_ADESIVO_RETANG = "prod-adesivo-retang";
const PROD_ADESIVO_REDONDO = "prod-adesivo-redondo";
const PROD_CARDAPIO_SIMPLES = "prod-cardapio-simples";
const PROD_CARDAPIO_DOBRADO = "prod-cardapio-dobrado";

async function seed() {
  console.log("Gráfica Kairós — Seed Script");
  console.log("============================\n");

  // Clear existing data in reverse dependency order
  console.log("Clearing existing data...");
  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(cartItems);
  await db.delete(priceRules);
  await db.delete(productVariants);
  await db.delete(products);
  await db.delete(paperTypes);
  await db.delete(finishings);
  await db.delete(categories);

  // ── Categories ──
  console.log("Inserting categories...");
  await db.insert(categories).values([
    { id: CAT_PANFLETOS, name: "Panfletos", slug: "panfletos", description: "Panfletos e folhetos para divulgação da sua marca", icon: "FileText", sortOrder: 1, active: true },
    { id: CAT_CARTOES, name: "Cartões de Visita", slug: "cartoes-de-visita", description: "Cartões profissionais que impressionam no primeiro contato", icon: "CreditCard", sortOrder: 2, active: true },
    { id: CAT_BANNERS, name: "Banners e Faixas", slug: "banners", description: "Banners e faixas para eventos, feiras e pontos de venda", icon: "Image", sortOrder: 3, active: true },
    { id: CAT_FOLDERS, name: "Folders", slug: "folders", description: "Folders dobráveis para apresentações institucionais", icon: "BookOpen", sortOrder: 4, active: true },
    { id: CAT_ADESIVOS, name: "Adesivos", slug: "adesivos", description: "Adesivos personalizados em diversos formatos e materiais", icon: "Sticker", sortOrder: 5, active: true },
    { id: CAT_CARDAPIOS, name: "Cardápios e Menus", slug: "cardapios", description: "Cardápios elegantes para restaurantes, cafés e bares", icon: "UtensilsCrossed", sortOrder: 6, active: true },
  ]);

  // ── Paper Types ──
  console.log("Inserting paper types...");
  await db.insert(paperTypes).values([
    { id: PAPER_COUCHE_90, name: "Couchê Fosco 90g", weightGsm: 90, finish: "fosco", costPerSheet: "0.0800", active: true, sortOrder: 1 },
    { id: PAPER_COUCHE_115, name: "Couchê Brilho 115g", weightGsm: 115, finish: "brilho", costPerSheet: "0.1200", active: true, sortOrder: 2 },
    { id: PAPER_COUCHE_150, name: "Couchê Fosco 150g", weightGsm: 150, finish: "fosco", costPerSheet: "0.1800", active: true, sortOrder: 3 },
    { id: PAPER_COUCHE_250, name: "Couchê Brilho 250g", weightGsm: 250, finish: "brilho", costPerSheet: "0.3200", active: true, sortOrder: 4 },
    { id: PAPER_OFFSET_75, name: "Offset 75g", weightGsm: 75, finish: "natural", costPerSheet: "0.0500", active: true, sortOrder: 5 },
    { id: PAPER_KRAFT_120, name: "Kraft 120g", weightGsm: 120, finish: "natural", costPerSheet: "0.1500", active: true, sortOrder: 6 },
  ]);

  // ── Finishings ──
  console.log("Inserting finishings...");
  await db.insert(finishings).values([
    { id: FIN_LAM_FOSCA, name: "Laminação Fosca", type: "laminacao", priceModifier: "0.0200", multiplier: "1.0000", active: true, sortOrder: 1 },
    { id: FIN_LAM_BRILHO, name: "Laminação Brilho", type: "laminacao", priceModifier: "0.0200", multiplier: "1.0000", active: true, sortOrder: 2 },
    { id: FIN_VERNIZ_TOTAL, name: "Verniz UV Total", type: "verniz", priceModifier: "0.0150", multiplier: "1.0000", active: true, sortOrder: 3 },
    { id: FIN_VERNIZ_LOCAL, name: "Verniz UV Localizado", type: "verniz", priceModifier: "0.0400", multiplier: "1.0000", active: true, sortOrder: 4 },
    { id: FIN_REFILE, name: "Refile", type: "refile", priceModifier: "0.0050", multiplier: "1.0000", active: true, sortOrder: 5 },
    { id: FIN_DOBRA, name: "Dobra", type: "dobra", priceModifier: "0.0100", multiplier: "1.0000", active: true, sortOrder: 6 },
    { id: FIN_CORTE_ESP, name: "Corte Especial", type: "corte_especial", priceModifier: "0.0500", multiplier: "1.0000", active: true, sortOrder: 7 },
  ]);

  // ── Products ──
  console.log("Inserting products...");
  await db.insert(products).values([
    // Panfletos
    { id: PROD_PANFLETO_A5, categoryId: CAT_PANFLETOS, name: "Panfleto A5", slug: "panfleto-a5", description: "Panfleto formato A5 (148x210mm), ideal para divulgação rápida", basePrice: "0.08", minQuantity: 500, quantitySteps: [500, 1000, 2000, 5000, 10000], active: true, seoTitle: "Panfleto A5 - Impressão Gráfica Kairós", seoDescription: "Panfletos A5 com impressão de alta qualidade. Entrega rápida." },
    { id: PROD_PANFLETO_A4, categoryId: CAT_PANFLETOS, name: "Panfleto A4", slug: "panfleto-a4", description: "Panfleto formato A4 (210x297mm), mais espaço para seu conteúdo", basePrice: "0.14", minQuantity: 500, quantitySteps: [500, 1000, 2000, 5000, 10000], active: true, seoTitle: "Panfleto A4 - Impressão Gráfica Kairós", seoDescription: "Panfletos A4 com impressão offset de alta qualidade." },
    { id: PROD_PANFLETO_A3, categoryId: CAT_PANFLETOS, name: "Panfleto A3", slug: "panfleto-a3", description: "Panfleto formato A3 (297x420mm), máximo impacto visual", basePrice: "0.22", minQuantity: 250, quantitySteps: [250, 500, 1000, 2000, 5000], active: true, seoTitle: "Panfleto A3 - Impressão Gráfica Kairós", seoDescription: "Panfletos A3 impressos em offset com cores vibrantes." },
    // Cartões de Visita
    { id: PROD_CARTAO_PADRAO, categoryId: CAT_CARTOES, name: "Cartão Padrão 9x5cm", slug: "cartao-padrao-9x5", description: "Cartão de visita no formato padrão 90x50mm", basePrice: "0.12", minQuantity: 100, quantitySteps: [100, 250, 500, 1000, 2000], active: true, seoTitle: "Cartão de Visita 9x5 - Gráfica Kairós", seoDescription: "Cartões de visita profissionais 9x5cm." },
    { id: PROD_CARTAO_MINI, categoryId: CAT_CARTOES, name: "Cartão Mini 5x5cm", slug: "cartao-mini-5x5", description: "Cartão quadrado compacto de 50x50mm", basePrice: "0.10", minQuantity: 100, quantitySteps: [100, 250, 500, 1000], active: true, seoTitle: "Cartão Mini 5x5 - Gráfica Kairós", seoDescription: "Mini cartões de visita quadrados." },
    { id: PROD_CARTAO_VERNIZ, categoryId: CAT_CARTOES, name: "Cartão com Verniz Localizado", slug: "cartao-verniz-localizado", description: "Cartão 9x5cm com acabamento em verniz UV localizado", basePrice: "0.25", minQuantity: 100, quantitySteps: [100, 250, 500, 1000], active: true, seoTitle: "Cartão Verniz Localizado - Gráfica Kairós", seoDescription: "Cartões de visita premium com verniz UV localizado." },
    // Banners
    { id: PROD_BANNER_60X90, categoryId: CAT_BANNERS, name: "Banner 60x90cm", slug: "banner-60x90", description: "Banner em lona 440g com acabamento em bastão e corda", basePrice: "35.00", minQuantity: 1, quantitySteps: [1, 2, 5, 10], active: true, seoTitle: "Banner 60x90 - Gráfica Kairós", seoDescription: "Banners em lona de alta resolução." },
    { id: PROD_BANNER_80X120, categoryId: CAT_BANNERS, name: "Banner 80x120cm", slug: "banner-80x120", description: "Banner em lona 440g tamanho grande", basePrice: "55.00", minQuantity: 1, quantitySteps: [1, 2, 5, 10], active: true, seoTitle: "Banner 80x120 - Gráfica Kairós", seoDescription: "Banners grandes em lona 440g." },
    // Folders
    { id: PROD_FOLDER_2DOBRAS, categoryId: CAT_FOLDERS, name: "Folder 2 Dobras", slug: "folder-2-dobras", description: "Folder com 2 dobras (3 painéis), formato aberto A4", basePrice: "0.35", minQuantity: 250, quantitySteps: [250, 500, 1000, 2000], active: true, seoTitle: "Folder 2 Dobras - Gráfica Kairós", seoDescription: "Folders com 2 dobras para apresentações." },
    { id: PROD_FOLDER_3DOBRAS, categoryId: CAT_FOLDERS, name: "Folder 3 Dobras", slug: "folder-3-dobras", description: "Folder com 3 dobras (4 painéis), formato aberto A3", basePrice: "0.50", minQuantity: 250, quantitySteps: [250, 500, 1000, 2000], active: true, seoTitle: "Folder 3 Dobras - Gráfica Kairós", seoDescription: "Folders com 3 dobras para material institucional." },
    // Adesivos
    { id: PROD_ADESIVO_RETANG, categoryId: CAT_ADESIVOS, name: "Adesivo Retangular", slug: "adesivo-retangular", description: "Adesivo retangular em vinil adesivo de alta durabilidade", basePrice: "0.15", minQuantity: 100, quantitySteps: [100, 250, 500, 1000, 2000], active: true, seoTitle: "Adesivo Retangular - Gráfica Kairós", seoDescription: "Adesivos retangulares personalizados." },
    { id: PROD_ADESIVO_REDONDO, categoryId: CAT_ADESIVOS, name: "Adesivo Redondo", slug: "adesivo-redondo", description: "Adesivo circular com corte especial", basePrice: "0.18", minQuantity: 100, quantitySteps: [100, 250, 500, 1000, 2000], active: true, seoTitle: "Adesivo Redondo - Gráfica Kairós", seoDescription: "Adesivos redondos com corte especial." },
    // Cardápios
    { id: PROD_CARDAPIO_SIMPLES, categoryId: CAT_CARDAPIOS, name: "Cardápio Simples", slug: "cardapio-simples", description: "Cardápio em folha única frente e verso", basePrice: "0.80", minQuantity: 50, quantitySteps: [50, 100, 250, 500], active: true, seoTitle: "Cardápio Simples - Gráfica Kairós", seoDescription: "Cardápios simples impressos em alta qualidade." },
    { id: PROD_CARDAPIO_DOBRADO, categoryId: CAT_CARDAPIOS, name: "Cardápio Dobrado", slug: "cardapio-dobrado", description: "Cardápio com dobra central, 4 páginas", basePrice: "1.40", minQuantity: 50, quantitySteps: [50, 100, 250, 500], active: true, seoTitle: "Cardápio Dobrado - Gráfica Kairós", seoDescription: "Cardápios dobrados com acabamento premium." },
  ]);

  // ── Product Variants ──
  console.log("Inserting product variants...");
  await db.insert(productVariants).values([
    // Panfleto A5
    { id: "var-pan-a5-c90-4x0", productId: PROD_PANFLETO_A5, paperTypeId: PAPER_COUCHE_90, finishingId: null, widthMm: 148, heightMm: 210, colorsFront: 4, colorsBack: 0, sku: "PAN-A5-C90-4x0", priceTable: { "500": 0.08, "1000": 0.06, "2000": 0.045, "5000": 0.035, "10000": 0.025 } },
    { id: "var-pan-a5-c115-4x4", productId: PROD_PANFLETO_A5, paperTypeId: PAPER_COUCHE_115, finishingId: null, widthMm: 148, heightMm: 210, colorsFront: 4, colorsBack: 4, sku: "PAN-A5-C115-4x4", priceTable: { "500": 0.12, "1000": 0.09, "2000": 0.07, "5000": 0.055, "10000": 0.04 } },
    // Panfleto A4
    { id: "var-pan-a4-c90-4x0", productId: PROD_PANFLETO_A4, paperTypeId: PAPER_COUCHE_90, finishingId: null, widthMm: 210, heightMm: 297, colorsFront: 4, colorsBack: 0, sku: "PAN-A4-C90-4x0", priceTable: { "500": 0.14, "1000": 0.10, "2000": 0.08, "5000": 0.06, "10000": 0.045 } },
    { id: "var-pan-a4-c150-lam-4x4", productId: PROD_PANFLETO_A4, paperTypeId: PAPER_COUCHE_150, finishingId: FIN_LAM_FOSCA, widthMm: 210, heightMm: 297, colorsFront: 4, colorsBack: 4, sku: "PAN-A4-C150-LAM-4x4", priceTable: { "500": 0.28, "1000": 0.22, "2000": 0.18, "5000": 0.14 } },
    // Cartão Padrão
    { id: "var-crt-9x5-c250-lamf", productId: PROD_CARTAO_PADRAO, paperTypeId: PAPER_COUCHE_250, finishingId: FIN_LAM_FOSCA, widthMm: 90, heightMm: 50, colorsFront: 4, colorsBack: 4, sku: "CRT-9X5-C250-LAM-4x4", priceTable: { "100": 0.25, "250": 0.18, "500": 0.12, "1000": 0.08, "2000": 0.06 } },
    { id: "var-crt-9x5-c250-lamb", productId: PROD_CARTAO_PADRAO, paperTypeId: PAPER_COUCHE_250, finishingId: FIN_LAM_BRILHO, widthMm: 90, heightMm: 50, colorsFront: 4, colorsBack: 4, sku: "CRT-9X5-C250-LAMB-4x4", priceTable: { "100": 0.25, "250": 0.18, "500": 0.12, "1000": 0.08, "2000": 0.06 } },
    // Cartão Verniz Localizado
    { id: "var-crt-9x5-c250-vuvi", productId: PROD_CARTAO_VERNIZ, paperTypeId: PAPER_COUCHE_250, finishingId: FIN_VERNIZ_LOCAL, widthMm: 90, heightMm: 50, colorsFront: 4, colorsBack: 4, sku: "CRT-9X5-C250-VUVI-4x4", priceTable: { "100": 0.45, "250": 0.35, "500": 0.25, "1000": 0.18 } },
    // Banners
    { id: "var-ban-60x90", productId: PROD_BANNER_60X90, paperTypeId: PAPER_COUCHE_150, finishingId: null, widthMm: 600, heightMm: 900, colorsFront: 4, colorsBack: 0, sku: "BAN-60X90-4x0", priceTable: { "1": 35.00, "2": 30.00, "5": 25.00, "10": 22.00 } },
    { id: "var-ban-80x120", productId: PROD_BANNER_80X120, paperTypeId: PAPER_COUCHE_150, finishingId: null, widthMm: 800, heightMm: 1200, colorsFront: 4, colorsBack: 0, sku: "BAN-80X120-4x0", priceTable: { "1": 55.00, "2": 48.00, "5": 42.00, "10": 38.00 } },
    // Folders
    { id: "var-fld-2d-c150", productId: PROD_FOLDER_2DOBRAS, paperTypeId: PAPER_COUCHE_150, finishingId: FIN_DOBRA, widthMm: 297, heightMm: 210, colorsFront: 4, colorsBack: 4, sku: "FLD-2D-C150-4x4", priceTable: { "250": 0.50, "500": 0.35, "1000": 0.28, "2000": 0.22 } },
    { id: "var-fld-3d-c150", productId: PROD_FOLDER_3DOBRAS, paperTypeId: PAPER_COUCHE_150, finishingId: FIN_DOBRA, widthMm: 420, heightMm: 297, colorsFront: 4, colorsBack: 4, sku: "FLD-3D-C150-4x4", priceTable: { "250": 0.70, "500": 0.50, "1000": 0.40, "2000": 0.32 } },
    // Adesivos
    { id: "var-ads-ret-10x7", productId: PROD_ADESIVO_RETANG, paperTypeId: PAPER_COUCHE_90, finishingId: FIN_REFILE, widthMm: 100, heightMm: 70, colorsFront: 4, colorsBack: 0, sku: "ADS-RET-10X7-4x0", priceTable: { "100": 0.15, "250": 0.12, "500": 0.09, "1000": 0.07, "2000": 0.05 } },
    { id: "var-ads-red-5cm", productId: PROD_ADESIVO_REDONDO, paperTypeId: PAPER_COUCHE_90, finishingId: FIN_CORTE_ESP, widthMm: 50, heightMm: 50, colorsFront: 4, colorsBack: 0, sku: "ADS-RED-5CM-4x0", priceTable: { "100": 0.18, "250": 0.14, "500": 0.10, "1000": 0.08, "2000": 0.06 } },
    // Cardápios
    { id: "var-cdp-sim-a4", productId: PROD_CARDAPIO_SIMPLES, paperTypeId: PAPER_COUCHE_250, finishingId: FIN_LAM_FOSCA, widthMm: 210, heightMm: 297, colorsFront: 4, colorsBack: 4, sku: "CDP-SIM-A4-C250-4x4", priceTable: { "50": 1.20, "100": 0.80, "250": 0.60, "500": 0.45 } },
    { id: "var-cdp-dob-a3", productId: PROD_CARDAPIO_DOBRADO, paperTypeId: PAPER_COUCHE_250, finishingId: FIN_DOBRA, widthMm: 297, heightMm: 420, colorsFront: 4, colorsBack: 4, sku: "CDP-DOB-A3-C250-4x4", priceTable: { "50": 2.00, "100": 1.40, "250": 1.00, "500": 0.80 } },
  ]);

  // ── Price Rules ──
  console.log("Inserting price rules...");
  await db.insert(priceRules).values([
    // Panfleto A5
    { id: "pr-pan-a5-1", productId: PROD_PANFLETO_A5, minQty: 500, maxQty: 999, pricePerUnit: "0.0800", setupFee: "0" },
    { id: "pr-pan-a5-2", productId: PROD_PANFLETO_A5, minQty: 1000, maxQty: 1999, pricePerUnit: "0.0600", setupFee: "0" },
    { id: "pr-pan-a5-3", productId: PROD_PANFLETO_A5, minQty: 2000, maxQty: 4999, pricePerUnit: "0.0450", setupFee: "0" },
    { id: "pr-pan-a5-4", productId: PROD_PANFLETO_A5, minQty: 5000, maxQty: 10000, pricePerUnit: "0.0350", setupFee: "0" },
    // Panfleto A4
    { id: "pr-pan-a4-1", productId: PROD_PANFLETO_A4, minQty: 500, maxQty: 999, pricePerUnit: "0.1400", setupFee: "0" },
    { id: "pr-pan-a4-2", productId: PROD_PANFLETO_A4, minQty: 1000, maxQty: 1999, pricePerUnit: "0.1000", setupFee: "0" },
    { id: "pr-pan-a4-3", productId: PROD_PANFLETO_A4, minQty: 2000, maxQty: 4999, pricePerUnit: "0.0800", setupFee: "0" },
    { id: "pr-pan-a4-4", productId: PROD_PANFLETO_A4, minQty: 5000, maxQty: 10000, pricePerUnit: "0.0600", setupFee: "0" },
    // Panfleto A3
    { id: "pr-pan-a3-1", productId: PROD_PANFLETO_A3, minQty: 250, maxQty: 499, pricePerUnit: "0.2200", setupFee: "0" },
    { id: "pr-pan-a3-2", productId: PROD_PANFLETO_A3, minQty: 500, maxQty: 999, pricePerUnit: "0.1800", setupFee: "0" },
    { id: "pr-pan-a3-3", productId: PROD_PANFLETO_A3, minQty: 1000, maxQty: 4999, pricePerUnit: "0.1400", setupFee: "0" },
    // Cartão Padrão
    { id: "pr-crt-pad-1", productId: PROD_CARTAO_PADRAO, minQty: 100, maxQty: 249, pricePerUnit: "0.2500", setupFee: "0" },
    { id: "pr-crt-pad-2", productId: PROD_CARTAO_PADRAO, minQty: 250, maxQty: 499, pricePerUnit: "0.1800", setupFee: "0" },
    { id: "pr-crt-pad-3", productId: PROD_CARTAO_PADRAO, minQty: 500, maxQty: 999, pricePerUnit: "0.1200", setupFee: "0" },
    { id: "pr-crt-pad-4", productId: PROD_CARTAO_PADRAO, minQty: 1000, maxQty: 2000, pricePerUnit: "0.0800", setupFee: "0" },
    // Cartão Mini
    { id: "pr-crt-mini-1", productId: PROD_CARTAO_MINI, minQty: 100, maxQty: 249, pricePerUnit: "0.2000", setupFee: "0" },
    { id: "pr-crt-mini-2", productId: PROD_CARTAO_MINI, minQty: 250, maxQty: 499, pricePerUnit: "0.1500", setupFee: "0" },
    { id: "pr-crt-mini-3", productId: PROD_CARTAO_MINI, minQty: 500, maxQty: 1000, pricePerUnit: "0.1000", setupFee: "0" },
    // Cartão Verniz
    { id: "pr-crt-ver-1", productId: PROD_CARTAO_VERNIZ, minQty: 100, maxQty: 249, pricePerUnit: "0.4500", setupFee: "0" },
    { id: "pr-crt-ver-2", productId: PROD_CARTAO_VERNIZ, minQty: 250, maxQty: 499, pricePerUnit: "0.3500", setupFee: "0" },
    { id: "pr-crt-ver-3", productId: PROD_CARTAO_VERNIZ, minQty: 500, maxQty: 1000, pricePerUnit: "0.2500", setupFee: "0" },
    // Banner 60x90
    { id: "pr-ban-60-1", productId: PROD_BANNER_60X90, minQty: 1, maxQty: 1, pricePerUnit: "35.0000", setupFee: "0" },
    { id: "pr-ban-60-2", productId: PROD_BANNER_60X90, minQty: 2, maxQty: 4, pricePerUnit: "30.0000", setupFee: "0" },
    { id: "pr-ban-60-3", productId: PROD_BANNER_60X90, minQty: 5, maxQty: 10, pricePerUnit: "25.0000", setupFee: "0" },
    // Banner 80x120
    { id: "pr-ban-80-1", productId: PROD_BANNER_80X120, minQty: 1, maxQty: 1, pricePerUnit: "55.0000", setupFee: "0" },
    { id: "pr-ban-80-2", productId: PROD_BANNER_80X120, minQty: 2, maxQty: 4, pricePerUnit: "48.0000", setupFee: "0" },
    { id: "pr-ban-80-3", productId: PROD_BANNER_80X120, minQty: 5, maxQty: 10, pricePerUnit: "42.0000", setupFee: "0" },
    // Folder 2 Dobras
    { id: "pr-fld-2d-1", productId: PROD_FOLDER_2DOBRAS, minQty: 250, maxQty: 499, pricePerUnit: "0.5000", setupFee: "0" },
    { id: "pr-fld-2d-2", productId: PROD_FOLDER_2DOBRAS, minQty: 500, maxQty: 999, pricePerUnit: "0.3500", setupFee: "0" },
    { id: "pr-fld-2d-3", productId: PROD_FOLDER_2DOBRAS, minQty: 1000, maxQty: 2000, pricePerUnit: "0.2800", setupFee: "0" },
    // Folder 3 Dobras
    { id: "pr-fld-3d-1", productId: PROD_FOLDER_3DOBRAS, minQty: 250, maxQty: 499, pricePerUnit: "0.7000", setupFee: "0" },
    { id: "pr-fld-3d-2", productId: PROD_FOLDER_3DOBRAS, minQty: 500, maxQty: 999, pricePerUnit: "0.5000", setupFee: "0" },
    { id: "pr-fld-3d-3", productId: PROD_FOLDER_3DOBRAS, minQty: 1000, maxQty: 2000, pricePerUnit: "0.4000", setupFee: "0" },
    // Adesivo Retangular
    { id: "pr-ads-ret-1", productId: PROD_ADESIVO_RETANG, minQty: 100, maxQty: 249, pricePerUnit: "0.1500", setupFee: "0" },
    { id: "pr-ads-ret-2", productId: PROD_ADESIVO_RETANG, minQty: 250, maxQty: 499, pricePerUnit: "0.1200", setupFee: "0" },
    { id: "pr-ads-ret-3", productId: PROD_ADESIVO_RETANG, minQty: 500, maxQty: 2000, pricePerUnit: "0.0900", setupFee: "0" },
    // Adesivo Redondo
    { id: "pr-ads-red-1", productId: PROD_ADESIVO_REDONDO, minQty: 100, maxQty: 249, pricePerUnit: "0.1800", setupFee: "0" },
    { id: "pr-ads-red-2", productId: PROD_ADESIVO_REDONDO, minQty: 250, maxQty: 499, pricePerUnit: "0.1400", setupFee: "0" },
    { id: "pr-ads-red-3", productId: PROD_ADESIVO_REDONDO, minQty: 500, maxQty: 2000, pricePerUnit: "0.1000", setupFee: "0" },
    // Cardápio Simples
    { id: "pr-cdp-sim-1", productId: PROD_CARDAPIO_SIMPLES, minQty: 50, maxQty: 99, pricePerUnit: "1.2000", setupFee: "0" },
    { id: "pr-cdp-sim-2", productId: PROD_CARDAPIO_SIMPLES, minQty: 100, maxQty: 249, pricePerUnit: "0.8000", setupFee: "0" },
    { id: "pr-cdp-sim-3", productId: PROD_CARDAPIO_SIMPLES, minQty: 250, maxQty: 500, pricePerUnit: "0.6000", setupFee: "0" },
    // Cardápio Dobrado
    { id: "pr-cdp-dob-1", productId: PROD_CARDAPIO_DOBRADO, minQty: 50, maxQty: 99, pricePerUnit: "2.0000", setupFee: "0" },
    { id: "pr-cdp-dob-2", productId: PROD_CARDAPIO_DOBRADO, minQty: 100, maxQty: 249, pricePerUnit: "1.4000", setupFee: "0" },
    { id: "pr-cdp-dob-3", productId: PROD_CARDAPIO_DOBRADO, minQty: 250, maxQty: 500, pricePerUnit: "1.0000", setupFee: "0" },
  ]);

  console.log("\nSeed complete!");
  console.log("  6 categories");
  console.log("  14 products");
  console.log("  6 paper types");
  console.log("  7 finishings");
  console.log("  16 product variants");
  console.log("  42 price rules");

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
