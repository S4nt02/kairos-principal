# Kairós Gráfica — Guia de Produção

> O que falta para ter o sistema 100% funcional em produção.

---

## Estado Atual

O sistema está **completo como MVP funcional**. Todas as fases 1-6 foram implementadas com MemStorage (dados em memória). O fluxo inteiro funciona:

```
Catálogo → Categoria → Configurador → Carrinho → Checkout → Pedido
                                                            ↓
                                    Admin Panel ← Gerência de Pedidos
```

### Páginas funcionais
| Rota | Página | Status |
|------|--------|--------|
| `/grafica` | Catálogo de categorias | OK |
| `/grafica/:slug` | Produtos da categoria | OK |
| `/grafica/produto/:slug` | Configurador de produto | OK |
| `/grafica/carrinho` | Carrinho de compras | OK |
| `/grafica/checkout` | Checkout multi-step | OK |
| `/grafica/pedido/:id` | Acompanhamento do pedido | OK |
| `/grafica/conta` | Painel do cliente | OK |
| `/grafica/admin` | Painel admin | OK |

### API endpoints (20+)
- Catálogo: 5 endpoints (GET categories, products, papers, finishings)
- Carrinho: 5 endpoints (CRUD + clear)
- Pedidos: 3 endpoints (create, get, update status)
- Checkout: 1 endpoint (processa pedido + pagamento simulado)
- Frete: 1 endpoint (cotação simulada)
- CEP: 1 endpoint (proxy ViaCEP — funcional)
- Upload: 1 endpoint (tracking simulado)
- Admin: 3 endpoints (list orders, tracking, art status)
- Conta: 1 endpoint (orders do cliente)
- Webhook: 1 endpoint (MercadoPago placeholder)

---

## O Que Falta Para Produção

### 1. Banco de Dados Real (CRÍTICO)

**Atual**: MemStorage — dados resetam ao reiniciar o servidor.
**Necessário**: PostgreSQL (Neon Serverless recomendado).

```bash
# 1. Criar conta no Neon (https://neon.tech) — free tier: 0.5GB
# 2. Copiar a connection string

# 3. Criar arquivo .env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/kairos?sslmode=require

# 4. Gerar e aplicar migrations
npx drizzle-kit generate
npx drizzle-kit push

# 5. Substituir MemStorage por DatabaseStorage no server/storage.ts
# Implementar cada método do IStorage usando Drizzle queries (db.select, db.insert, etc.)
```

**Estimativa**: 3-4 horas de trabalho.

### 2. Autenticação de Clientes (IMPORTANTE)

**Atual**: Todos os pedidos são criados como "guest", sem login.
**Necessário**: Sistema de cadastro/login com JWT ou sessions.

Tarefas:
- [ ] Endpoint `POST /api/auth/register` — cria customer com bcrypt/argon2
- [ ] Endpoint `POST /api/auth/login` — retorna JWT ou session cookie
- [ ] Endpoint `POST /api/auth/forgot-password` — envia email de recuperação
- [ ] Middleware `auth.ts` — valida JWT em rotas protegidas
- [ ] Middleware `admin.ts` — valida que user é admin (tabela `users` existente)
- [ ] Migrar carrinho do `sessionId` para `customerId` ao fazer login
- [ ] Proteger rotas `/api/grafica/account/*` com auth middleware
- [ ] Proteger rotas `/api/grafica/admin/*` com admin middleware

**Estimativa**: 6-8 horas.

### 3. Integração MercadoPago (IMPLEMENTADO)

**Status**: Checkout Pro integrado via SDK `mercadopago` v2.

Implementação:
- [x] SDK `mercadopago` instalado
- [x] Serviço `server/services/mercadopago.ts` (createPreference, getPayment, mapPaymentStatus)
- [x] Checkout cria preferência MP com items, back_urls, notification_url, external_reference
- [x] Frontend redireciona para `init_point` do MercadoPago (Pix, Cartão, Boleto na tela do MP)
- [x] Webhook `POST /api/webhooks/mercadopago` busca payment na API do MP (nunca confia no body)
- [x] Atualização idempotente do status do pedido
- [x] Página de pedido com auto-polling de status e banners de feedback
- [x] Campo `mp_preference_id` na tabela `orders`

**Pendente (requer intervenção humana):**
- [ ] Testar em sandbox com conta de teste do MercadoPago
- [ ] Configurar `SITE_URL` para URL pública (ngrok para dev, domínio real para produção)
- [ ] Configurar webhook URL no painel do MercadoPago (https://www.mercadopago.com.br/developers/panel/app)
- [ ] Validar assinatura HMAC do webhook `x-signature` (opcional para MVP, recomendado para produção)
- [ ] Mudar credenciais de sandbox para produção antes do launch

### 4. Integração Melhor Envio (IMPORTANTE)

**Atual**: Frete com valores fixos simulados (PAC R$18.90, SEDEX R$32.50).
**Necessário**: API real do Melhor Envio.

Tarefas:
- [ ] Criar conta no Melhor Envio (https://melhorenvio.com.br)
- [ ] Obter token de API
- [ ] Implementar `server/services/shipping.service.ts`:
  - Calcular peso do pacote (gramatura × área × quantidade)
  - Chamar API `/api/v2/me/shipment/calculate`
  - Retornar opções filtradas (PAC, SEDEX, Jadlog, etc.)
- [ ] Implementar geração de etiqueta de frete pós-pagamento
- [ ] Variáveis de ambiente:
  ```
  MELHOR_ENVIO_TOKEN=xxx
  WAREHOUSE_CEP=01001000  # CEP da gráfica
  ```

**Estimativa**: 4-6 horas.

### 5. Upload de Arte para Storage (IMPORTANTE)

**Atual**: Upload tracked in-memory, arquivo não é salvo de fato.
**Necessário**: Cloudflare R2 ou AWS S3.

Tarefas:
- [ ] Criar bucket R2 no Cloudflare (ou S3 na AWS)
- [ ] Implementar `server/services/upload.service.ts`:
  - Gerar signed URL (PUT) com TTL de 15min
  - Frontend faz upload direto para R2 (não passa pelo servidor)
  - Endpoint de confirmação valida que arquivo existe
- [ ] Validação de arte server-side (opcional, mas recomendado):
  - Verificar magic bytes (PDF real? TIFF real?)
  - Verificar DPI com `sharp` (npm install sharp)
  - Verificar colorspace (CMYK vs RGB — avisar se RGB)
  - Gerar thumbnail para preview
- [ ] Variáveis de ambiente:
  ```
  R2_ACCOUNT_ID=xxx
  R2_ACCESS_KEY_ID=xxx
  R2_SECRET_ACCESS_KEY=xxx
  R2_BUCKET_NAME=kairos-artes
  ```

**Estimativa**: 6-8 horas.

### 6. Emails Transacionais (IMPORTANTE)

**Atual**: Nenhum email é enviado.
**Necessário**: Emails de confirmação, status update, recuperação de senha.

Tarefas:
- [ ] Criar conta no Resend (https://resend.com) — 3000 emails/mês grátis
- [ ] Configurar domínio e DNS (SPF, DKIM, DMARC)
- [ ] Implementar `server/services/email.service.ts`:
  - Template de confirmação de pedido
  - Template de pagamento aprovado
  - Template de pedido em produção
  - Template de pedido enviado (com tracking)
  - Template de recuperação de senha
- [ ] Disparar emails nos momentos certos (pós-checkout, pós-pagamento, mudança de status)
- [ ] Variáveis de ambiente:
  ```
  RESEND_API_KEY=re_xxx
  EMAIL_FROM=pedidos@kairos.com.br
  ```

**Estimativa**: 4-6 horas.

### 7. Segurança (CRÍTICO antes de produção)

Tarefas:
- [ ] Instalar e configurar Helmet.js:
  ```bash
  npm install helmet
  ```
  ```typescript
  import helmet from "helmet";
  app.use(helmet());
  ```
- [ ] CORS restrito ao domínio:
  ```typescript
  import cors from "cors";
  app.use(cors({ origin: "https://kairos.com.br", credentials: true }));
  ```
- [ ] Rate limiting:
  ```bash
  npm install express-rate-limit
  ```
  - Global: 100 req/min por IP
  - Checkout: 3 req/min
  - Upload: 5 req/hora
- [ ] HTTPS forçado em produção (Cloudflare faz isso automaticamente)
- [ ] Validação anti-fraude de preço (server recalcula preço e compara com frontend)
- [ ] Sanitizar input de strings (XSS prevention)
- [ ] Cookies de sessão: `HttpOnly`, `Secure`, `SameSite=Strict`
- [ ] Variáveis sensíveis NUNCA no código — usar `.env` ou Cloudflare Secrets

**Estimativa**: 3-4 horas.

### 8. Deploy (Cloudflare Workers)

**Atual**: `npm run dev` local na porta 5000.
**Necessário**: Deploy em produção.

```bash
# Opção A: Cloudflare Workers (recomendado)
# O projeto já tem wrangler.toml configurado

# 1. Build
npm run build

# 2. Deploy
npx wrangler deploy

# 3. Configurar secrets
npx wrangler secret put DATABASE_URL
npx wrangler secret put MP_ACCESS_TOKEN
npx wrangler secret put MELHOR_ENVIO_TOKEN
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

```bash
# Opção B: VPS (Railway, Render, DigitalOcean)
# 1. Configurar Dockerfile ou usar o npm start
# 2. Configurar variáveis de ambiente no painel
# 3. Configurar domínio customizado
```

**Domínio**: Configurar DNS para apontar para o deploy.

### 9. SEO e Meta Tags (RECOMENDADO)

Tarefas:
- [ ] Meta tags dinâmicas para cada produto (og:title, og:description, og:image)
- [ ] Sitemap XML (`/sitemap.xml`) listando todas as categorias e produtos
- [ ] Structured Data (JSON-LD) para produtos — Google Rich Results:
  ```json
  {
    "@type": "Product",
    "name": "Panfleto A5",
    "offers": { "@type": "AggregateOffer", "lowPrice": "0.035" }
  }
  ```
- [ ] robots.txt
- [ ] Canonical URLs

**Estimativa**: 2-3 horas.

### 10. Monitoramento (RECOMENDADO)

Tarefas:
- [ ] Instalar Sentry (`npm install @sentry/node @sentry/react`)
- [ ] Configurar error tracking no frontend e backend
- [ ] Configurar performance monitoring
- [ ] Alertas para erros de pagamento

**Estimativa**: 1-2 horas.

---

## Checklist Final de Launch

```
PRÉ-LAUNCH
├── [ ] Banco PostgreSQL configurado e seed executado
├── [ ] Autenticação de clientes implementada
├── [ ] MercadoPago integrado e testado (sandbox → produção)
├── [ ] Melhor Envio integrado e testado
├── [ ] Upload de arte funcionando com R2/S3
├── [ ] Emails transacionais funcionando
├── [ ] Helmet + CORS + Rate Limit configurados
├── [ ] HTTPS configurado
├── [ ] Domínio configurado
├── [ ] Deploy em staging testado
│
TESTES
├── [ ] Fluxo completo: catálogo → configurar → carrinho → checkout → pedido
├── [ ] Pagamento Pix (sandbox MercadoPago)
├── [ ] Pagamento Boleto (sandbox)
├── [ ] Pagamento Cartão (sandbox)
├── [ ] Upload de arte (PDF real)
├── [ ] Cotação de frete com CEPs reais
├── [ ] Admin: alterar status, ver detalhes
├── [ ] Mobile responsivo
│
PÓS-LAUNCH
├── [ ] Monitoramento Sentry ativo
├── [ ] Backup automático do banco (Neon faz)
├── [ ] Google Analytics / Tag Manager
├── [ ] Google Search Console + sitemap submetido
├── [ ] Testar webhook MercadoPago em produção
```

---

## Variáveis de Ambiente Completas

```env
# Database
DATABASE_URL=postgresql://user:pass@host/kairos?sslmode=require

# MercadoPago
MP_ACCESS_TOKEN=APP_USR-xxx
MP_PUBLIC_KEY=APP_USR-xxx
MP_WEBHOOK_SECRET=xxx

# Melhor Envio
MELHOR_ENVIO_TOKEN=xxx
WAREHOUSE_CEP=01001000

# Storage (R2)
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=kairos-artes

# Email
RESEND_API_KEY=re_xxx
EMAIL_FROM=pedidos@kairos.com.br

# Auth
JWT_SECRET=xxx  # Gerar com: openssl rand -base64 32
SESSION_SECRET=xxx

# App
NODE_ENV=production
API_URL=https://api.kairos.com.br
FRONTEND_URL=https://kairos.com.br

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Estimativa Total de Trabalho

| Item | Horas | Prioridade |
|------|-------|------------|
| Banco de dados real (Neon) | 3-4h | CRÍTICO |
| Autenticação de clientes | 6-8h | IMPORTANTE |
| MercadoPago | 8-12h | CRÍTICO |
| Melhor Envio | 4-6h | IMPORTANTE |
| Upload R2/S3 | 6-8h | IMPORTANTE |
| Emails (Resend) | 4-6h | IMPORTANTE |
| Segurança (Helmet, CORS, Rate Limit) | 3-4h | CRÍTICO |
| Deploy + domínio | 2-3h | CRÍTICO |
| SEO | 2-3h | RECOMENDADO |
| Monitoramento (Sentry) | 1-2h | RECOMENDADO |
| **TOTAL** | **~40-56h** | — |

---

## Custos Operacionais Estimados

| Serviço | Free Tier | Pago (escala) |
|---------|-----------|---------------|
| Cloudflare Workers | 100K req/dia | $5/mês (10M req) |
| Neon PostgreSQL | 0.5GB | ~R$50/mês (10GB) |
| Cloudflare R2 | 10GB + 1M reads | ~R$5/mês |
| Resend | 3K emails/mês | ~R$20/mês |
| Melhor Envio | Sem mensalidade | Taxa no frete |
| MercadoPago | Sem mensalidade | 3.5-5% por venda |
| Sentry | 5K errors/mês | Grátis |
| **Total inicial** | **~R$0/mês** | **~R$80/mês (escala)** |
