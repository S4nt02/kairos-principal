# Arquitetura de Software: Kairós Gráfica — E-commerce de Gráfica Online

> Documento técnico completo para implementação do módulo de gráfica online do Kairós.
> Projetado para performance zero-gargalo, segurança em camadas e escalabilidade horizontal.

---

## 0. Decisão Arquitetural: Por Que NÃO Migrar para Next.js + Medusa.js

Sua arquitetura original propunha **Next.js + Medusa.js**. Após análise do codebase existente, essa migração seria **contraproducente** pelos seguintes motivos:

| Fator | Next.js + Medusa | Stack Atual Evoluída |
|-------|-----------------|---------------------|
| **Reuso do código existente** | ~0% (reescrita total) | ~95% (evolução incremental) |
| **Tempo até produção** | 4-6 meses | 6-10 semanas |
| **Complexidade operacional** | 2 servidores (Next + Medusa) | 1 servidor (Express unificado) |
| **Custo de hospedagem** | ~R$150-400/mês (Vercel + Render) | ~R$0-50/mês (Cloudflare Workers + D1/Neon) |
| **Controle sobre o configurador** | Limitado pelas abstrações do Medusa | Total — código proprietário |
| **SEO para produtos** | SSR nativo | SSR via Express + prerendering |
| **Animações existentes (GSAP/Lenis)** | Precisa recriar tudo | Preservadas intactas |

**Veredicto:** Evoluir o stack atual. O Medusa.js é excelente para e-commerces genéricos, mas uma gráfica online tem lógica de negócio tão específica (configurador de atributos, cálculo matricial de preço, validação de arte) que você acabaria sobrescrevendo 70% do Medusa com código customizado.

---

## 1. Stack Tecnológica Definitiva

### Core (já existente — manter)
| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Frontend** | React 19 + Vite 7 + TypeScript | Já em produção, ecossistema maduro |
| **Roteamento Client** | Wouter | Leve (2KB), já implementado |
| **UI Components** | shadcn/ui + Radix UI | 50+ componentes prontos no projeto |
| **Animações** | GSAP + Framer Motion + Lenis | Stack premium de animações já configurado |
| **Estilo** | Tailwind CSS 4 | Já com tema personalizado (gold/terracotta) |
| **Backend** | Express 5 + TypeScript | API REST, já configurado |
| **ORM** | Drizzle ORM | Type-safe, migrations automáticas |
| **Validação** | Zod + React Hook Form | Já integrado no projeto |
| **State** | TanStack Query v5 | Cache inteligente, já configurado |

### Novas Adições (o que falta)
| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Banco de Dados** | PostgreSQL (Neon Serverless) | Compatível com Cloudflare Workers, connection pooling nativo, free tier generoso |
| **Cache / Sessão** | Upstash Redis | Serverless Redis, <1ms latência, SDK para Cloudflare Workers |
| **Storage de Arquivos** | Cloudflare R2 | Mesmo edge network do Workers = upload ultrarrápido, sem egress fees, S3-compatible |
| **Fila de Tarefas** | Cloudflare Queues | Nativo do ecossistema, para emails e processamento async |
| **Pagamento** | Mercado Pago SDK v2 | Checkout Pro transparente, Pix, Boleto, Cartão |
| **Frete** | Melhor Envio API v2 | Cotação multi-transportadora em tempo real |
| **Email** | Resend | API moderna, templates React, 3000 emails/mês grátis |
| **Monitoramento** | Sentry | Error tracking + performance monitoring, free tier |
| **Validação de Arte** | Sharp + pdf-lib | Validação de DPI, colorspace, sangria — server-side |

---

## 2. Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE EDGE NETWORK                       │
│                                                                       │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │  CDN / Cache  │    │  Workers (API)    │    │    R2 (Storage)   │   │
│  │  Assets SPA   │◄──►│  Express Server   │◄──►│  Artes clientes  │   │
│  │  HTML/JS/CSS  │    │  + SSR Produtos   │    │  Thumbnails      │   │
│  └──────────────┘    └────────┬─────────┘    └──────────────────┘   │
│                               │                                       │
│                    ┌──────────┼──────────┐                           │
│                    │    Cloudflare Queues  │                           │
│                    │  (email, validação)   │                           │
│                    └──────────────────────┘                           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                 ┌──────────────┼──────────────┐
                 │              │              │
          ┌──────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
          │   Neon DB    │ │ Upstash  │ │  APIs Ext.  │
          │ PostgreSQL   │ │  Redis   │ │ MercadoPago │
          │ (Serverless) │ │ (Cache)  │ │ MelhorEnvio │
          └─────────────┘ └──────────┘ │   Resend    │
                                        └────────────┘
```

### Por que tudo na Cloudflare?
- **Latência mínima**: Seu frontend, API, e storage estão no **mesmo edge node** — zero round-trip entre serviços
- **Custo previsível**: R2 não cobra egress (download), Workers tem 100k requests/dia grátis
- **Segurança nativa**: DDoS protection, WAF, Bot Management incluídos
- **Deploy atômico**: `wrangler deploy` atualiza tudo em segundos

---

## 3. Modelagem de Dados (PostgreSQL + Drizzle ORM)

### 3.1. Diagrama Entidade-Relacionamento

```
┌──────────────┐       ┌──────────────────┐       ┌────────────────┐
│   categories  │       │     products      │       │  paper_types    │
│──────────────│       │──────────────────│       │────────────────│
│ id (PK)      │──┐    │ id (PK)          │    ┌──│ id (PK)        │
│ name         │  └───►│ category_id (FK)  │    │  │ name           │
│ slug         │       │ name              │    │  │ weight_gsm     │
│ description  │       │ slug              │    │  │ finish         │
│ icon         │       │ description       │    │  │ cost_per_sheet │
│ image_url    │       │ base_price        │    │  │ active         │
│ sort_order   │       │ min_quantity      │    │  └────────────────┘
│ active       │       │ quantity_steps[]  │    │
└──────────────┘       │ active            │    │  ┌────────────────┐
                       │ seo_title         │    │  │  finishings     │
                       │ seo_description   │    │  │────────────────│
                       └────────┬─────────┘    ├──│ id (PK)        │
                                │              │  │ name           │
                       ┌────────▼─────────┐    │  │ type           │
                       │ product_variants  │    │  │ price_modifier │
                       │──────────────────│    │  │ multiplier     │
                       │ id (PK)          │    │  │ active         │
                       │ product_id (FK)  │    │  └────────────────┘
                       │ paper_type_id(FK)│◄───┘
                       │ finishing_id (FK)│◄───┘  ┌────────────────┐
                       │ width_mm         │       │  price_rules    │
                       │ height_mm        │       │────────────────│
                       │ colors_front     │       │ id (PK)        │
                       │ colors_back      │       │ product_id(FK) │
                       │ price_table JSONB│       │ min_qty        │
                       │ sku              │       │ max_qty        │
                       └──────────────────┘       │ price_per_unit │
                                                  │ setup_fee      │
                                                  └────────────────┘

┌──────────────┐       ┌──────────────────┐       ┌────────────────┐
│   customers   │       │      orders       │       │  order_items    │
│──────────────│       │──────────────────│       │────────────────│
│ id (PK)      │──┐    │ id (PK)          │──┐    │ id (PK)        │
│ email        │  │    │ customer_id (FK) │  │    │ order_id (FK)  │
│ name         │  └───►│ status           │  └───►│ product_name   │
│ phone        │       │ payment_status   │       │ configuration  │
│ cpf_cnpj     │       │ payment_method   │       │ quantity       │
│ password_hash│       │ payment_id       │       │ unit_price     │
│ created_at   │       │ subtotal         │       │ total_price    │
│ verified     │       │ shipping_cost    │       │ art_file_url   │
└──────────────┘       │ total            │       │ art_status     │
                       │ shipping_method  │       │ art_validated  │
┌──────────────┐       │ tracking_code    │       └────────────────┘
│  addresses    │       │ notes            │
│──────────────│       │ created_at       │       ┌────────────────┐
│ id (PK)      │       │ paid_at          │       │  cart_items     │
│ customer_id  │       │ shipped_at       │       │────────────────│
│ label        │       └──────────────────┘       │ id (PK)        │
│ cep          │                                  │ session_id     │
│ street       │                                  │ customer_id    │
│ number       │                                  │ product_config │
│ complement   │                                  │ quantity       │
│ neighborhood │                                  │ calculated_price│
│ city         │                                  │ art_file_url   │
│ state        │                                  │ created_at     │
│ is_default   │                                  └────────────────┘
└──────────────┘
```

### 3.2. Decisões de Modelagem

- **`price_table` como JSONB**: Cada variante armazena uma tabela de preços por faixa de quantidade. Isso permite consultas rápidas sem JOINs complexos e é flexível para promoções.
- **`configuration` como JSONB no `order_items`**: Registra o "snapshot" exato da configuração escolhida (papel, acabamento, cores, formato) no momento da compra — imutável, para auditoria.
- **`cart_items` com `session_id`**: Permite carrinho para visitantes (sem conta). Ao criar conta, migra pelo `customer_id`.
- **Separação `customers` vs `users`**: A tabela `users` existente é para admin. `customers` é para compradores.
- **`art_status` enum**: `pending | uploaded | validating | approved | rejected` — workflow completo da arte.

---

## 4. O Configurador de Produtos (O Coração do Sistema)

### 4.1. Arquitetura do Configurador

```
┌─────────────────────────────────────────────────────┐
│              CONFIGURADOR (Frontend)                  │
│                                                       │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌───────┐ │
│  │Formato  │  │  Papel    │  │Acabament│  │ Quant.│ │
│  │A3/A4/A5 │  │Couché 90g│  │Lamin.   │  │ 1000  │ │
│  │Custom   │  │Offset 75g│  │Verniz   │  │ 2000  │ │
│  │         │  │Kraft 120g│  │Refile   │  │ 5000  │ │
│  └────┬────┘  └────┬─────┘  └────┬────┘  └───┬───┘ │
│       │            │             │            │      │
│       └────────────┼─────────────┼────────────┘      │
│                    ▼                                  │
│         ┌──────────────────┐                         │
│         │  PRICE ENGINE    │  ◄── Cálculo LOCAL       │
│         │  (WebWorker)     │      para UX instantânea │
│         │                  │                          │
│         │  preço = (       │                          │
│         │    base_price    │                          │
│         │    × paper_mult  │                          │
│         │    × color_mult  │                          │
│         │    + finishing    │                          │
│         │  ) × qty_factor  │                          │
│         │    + setup_fee   │                          │
│         └────────┬─────────┘                         │
│                  │                                    │
│         ┌────────▼─────────┐                         │
│         │   R$ 247,50      │  ◄── Preço exibido       │
│         │   (atualiza em   │      em <16ms            │
│         │    tempo real)   │                          │
│         └──────────────────┘                         │
└─────────────────────────────────────────────────────┘
                    │
                    │ POST /api/cart/add
                    │ { product_id, config, qty, price }
                    ▼
┌─────────────────────────────────────────────────────┐
│              VALIDADOR (Backend)                      │
│                                                       │
│  1. Recebe config + preço calculado pelo frontend     │
│  2. Recalcula preço server-side com mesma fórmula     │
│  3. Compara: |preço_front - preço_back| < R$0.01?    │
│     ├── SIM → Adiciona ao carrinho                   │
│     └── NÃO → Rejeita (possível fraude/bug)          │
│  4. Assina o item do carrinho com HMAC-SHA256         │
│     (impede alteração no localStorage/cookie)         │
└─────────────────────────────────────────────────────┘
```

### 4.2. Price Engine — Regras de Cálculo

```typescript
// Executado em WebWorker para não bloquear a UI thread

interface PriceInput {
  basePrice: number;          // Preço base do produto (ex: R$0.15/un para panfleto)
  paperMultiplier: number;    // Couché 90g = 1.0, Couché 150g = 1.4, Kraft = 1.2
  colorConfig: ColorConfig;   // 4x0 = 1.0, 4x1 = 1.2, 4x4 = 1.5
  finishings: Finishing[];    // [{type: 'laminacao_fosca', price: 0.03}, ...]
  quantity: number;           // 1000, 2000, 5000...
  format: Format;             // {width: 210, height: 297} (mm)
}

interface PriceBreakdown {
  unitPrice: number;
  finishingTotal: number;
  setupFee: number;
  subtotal: number;
  discount: number;           // Desconto por volume
  total: number;
  pricePerUnit: number;       // Para exibir "R$0.24/un"
}

function calculatePrice(input: PriceInput): PriceBreakdown {
  // 1. Área relativa (formato custom vs padrão A4)
  const areaFactor = (input.format.width * input.format.height) / (210 * 297);

  // 2. Preço unitário base ajustado
  const adjustedBase = input.basePrice * input.paperMultiplier
                       * input.colorConfig.multiplier * areaFactor;

  // 3. Acabamentos (somatório aditivo por unidade)
  const finishingPerUnit = input.finishings.reduce((sum, f) => sum + f.price, 0);

  // 4. Preço unitário final
  const unitPrice = adjustedBase + finishingPerUnit;

  // 5. Setup fee (custo fixo de chapa/impressão — diluído na quantidade)
  const setupFee = getSetupFee(input.quantity); // ex: 1000un=R$45, 5000un=R$45 (fixo)

  // 6. Subtotal
  const subtotal = (unitPrice * input.quantity) + setupFee;

  // 7. Desconto por volume (tabela escalonada)
  const discount = getVolumeDiscount(input.quantity, subtotal);
  // 1-999: 0%, 1000-4999: 5%, 5000-9999: 10%, 10000+: 15%

  // 8. Total final
  const total = subtotal - discount;

  return {
    unitPrice,
    finishingTotal: finishingPerUnit * input.quantity,
    setupFee,
    subtotal,
    discount,
    total: Math.round(total * 100) / 100, // Arredonda centavos
    pricePerUnit: Math.round((total / input.quantity) * 100) / 100,
  };
}
```

### 4.3. Por que WebWorker?

- O cálculo precisa rodar em **<16ms** para manter 60fps durante interação com sliders
- WebWorker roda em thread separada → animações GSAP/Lenis **nunca** sofrem jank
- O worker pré-carrega todas as tabelas de preço no `postMessage` inicial (cache local)
- Recálculo é **síncrono dentro do worker**, mas **assíncrono para a UI**

---

## 5. Fluxo de Upload de Arte (Seguro)

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│  Cliente  │                    │  Express  │                    │    R2    │
│ (Browser) │                    │  (API)    │                    │(Storage) │
└─────┬────┘                    └─────┬────┘                    └─────┬────┘
      │                               │                               │
      │  1. POST /api/upload/request   │                               │
      │  { filename, size, mimetype }  │                               │
      │──────────────────────────────►│                               │
      │                               │                               │
      │                               │ 2. VALIDAÇÕES PRÉ-UPLOAD:     │
      │                               │    - Mime: PDF, TIFF, AI, PSD │
      │                               │    - Tamanho: max 150MB       │
      │                               │    - Rate limit: 5 uploads/h  │
      │                               │    - Gera UUID para filename  │
      │                               │                               │
      │  3. Retorna signed URL         │  Gera presigned PUT URL      │
      │  { uploadUrl, fileKey,         │  (expira em 15 min)          │
      │    maxSize, expiresAt }        │──────────────────────────────►│
      │◄──────────────────────────────│                               │
      │                               │                               │
      │  4. PUT direto para R2         │                               │
      │  (arquivo pesado NÃO          │                               │
      │   passa pelo servidor)         │                               │
      │──────────────────────────────────────────────────────────────►│
      │                               │                               │
      │  5. 200 OK                     │                               │
      │◄──────────────────────────────────────────────────────────────│
      │                               │                               │
      │  6. POST /api/upload/confirm   │                               │
      │  { fileKey }                   │                               │
      │──────────────────────────────►│                               │
      │                               │ 7. VALIDAÇÕES PÓS-UPLOAD:     │
      │                               │    - Arquivo existe no R2?    │
      │                               │    - Tamanho real ≤ max?      │
      │                               │    - Magic bytes = PDF/TIFF?  │
      │                               │    - (async) DPI ≥ 150?       │
      │                               │    - (async) Colorspace CMYK? │
      │                               │    - (async) Sangria ok?      │
      │                               │                               │
      │  8. { status: "validating",    │                               │
      │       thumbnailUrl }           │  Gera thumbnail via Sharp     │
      │◄──────────────────────────────│                               │
```

### 5.1. Segurança do Upload

| Ameaça | Contramedida |
|--------|-------------|
| Upload de malware disfarçado de PDF | Verificação de magic bytes server-side (não confiar no Content-Type do browser) |
| Arquivo gigante que estoura o storage | Signed URL com `Content-Length` máximo; R2 rejeita automaticamente |
| Spam de uploads | Rate limit por IP (5/hora) + por sessão (10/dia) |
| Acesso não autorizado à arte | URLs do R2 são privadas; acesso somente via signed URLs com TTL de 1h |
| Path traversal no filename | UUID gerado server-side; nome original apenas como metadata |
| Upload de arquivo com script embutido | Content-Disposition: attachment forçado; nunca servido como inline |

---

## 6. Checkout e Pagamento

### 6.1. Fluxo Completo

```
 CARRINHO        IDENTIFICAÇÃO       ENDEREÇO         FRETE           PAGAMENTO        CONFIRMAÇÃO
┌─────────┐     ┌──────────────┐   ┌──────────┐   ┌──────────┐    ┌──────────────┐   ┌──────────┐
│ Resumo   │     │ Email/CPF    │   │ CEP →    │   │ Melhor   │    │ Mercado Pago │   │ Pedido   │
│ Config.  │────►│ Nome/Telefone│──►│ Autocmpl.│──►│ Envio    │───►│ Transparente │──►│ #12345   │
│ Preço    │     │ Senha (opt.) │   │ ViaCEP   │   │ Opções   │    │              │   │ Status   │
│ Arte ✓   │     └──────────────┘   └──────────┘   │ Sedex    │    │ ┌──────────┐ │   │ Tracking │
└─────────┘                                        │ PAC      │    │ │   PIX    │ │   └──────────┘
                                                   │ Jadlog   │    │ │  Boleto  │ │
                                                   └──────────┘    │ │  Cartão  │ │
                                                                   │ └──────────┘ │
                                                                   └──────────────┘
```

### 6.2. Integração Mercado Pago (Transparente)

```typescript
// Backend: POST /api/checkout/payment
async function createPayment(order: Order, method: PaymentMethod) {
  const mercadopago = new MercadoPagoConfig({ accessToken: env.MP_ACCESS_TOKEN });
  const payment = new Payment(mercadopago);

  // Dados comuns
  const basePaymentData = {
    transaction_amount: order.total,
    description: `Kairós Gráfica - Pedido #${order.id}`,
    external_reference: order.id,
    notification_url: `${env.API_URL}/api/webhooks/mercadopago`,
    payer: {
      email: order.customer.email,
      identification: {
        type: order.customer.cpf_cnpj.length === 11 ? 'CPF' : 'CNPJ',
        number: order.customer.cpf_cnpj,
      },
    },
  };

  switch (method) {
    case 'pix':
      return payment.create({
        body: {
          ...basePaymentData,
          payment_method_id: 'pix',
          // QR Code gerado automaticamente na resposta
        },
      });

    case 'boleto':
      return payment.create({
        body: {
          ...basePaymentData,
          payment_method_id: 'bolbradesco',
          date_of_expiration: addDays(new Date(), 3).toISOString(),
        },
      });

    case 'credit_card':
      return payment.create({
        body: {
          ...basePaymentData,
          payment_method_id: method.cardBrand, // visa, mastercard...
          token: method.cardToken,              // Tokenizado no frontend via SDK
          installments: method.installments,
          // NUNCA receber número do cartão no backend
        },
      });
  }
}
```

### 6.3. Webhook de Confirmação (Seguro)

```typescript
// POST /api/webhooks/mercadopago
async function handleMercadoPagoWebhook(req: Request) {
  // 1. Validar assinatura HMAC do Mercado Pago
  const signature = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];

  if (!verifyWebhookSignature(signature, requestId, req.body, env.MP_WEBHOOK_SECRET)) {
    throw new ForbiddenError('Invalid webhook signature');
  }

  // 2. Buscar pagamento diretamente na API do MP (nunca confiar no body do webhook)
  const paymentId = req.body.data.id;
  const payment = await mercadopago.payment.get({ id: paymentId });

  // 3. Processar com idempotência (evitar processar duplicado)
  const orderId = payment.external_reference;
  const existing = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.payment_id, paymentId)),
  });

  if (existing?.payment_status === 'paid') return; // Já processado

  // 4. Atualizar status
  if (payment.status === 'approved') {
    await db.update(orders)
      .set({
        payment_status: 'paid',
        paid_at: new Date(),
        payment_id: String(paymentId),
      })
      .where(eq(orders.id, orderId));

    // 5. Disparar ações pós-pagamento (via Cloudflare Queue — não bloqueia o webhook)
    await env.ORDER_QUEUE.send({
      type: 'payment_confirmed',
      orderId,
      actions: ['send_confirmation_email', 'notify_admin', 'generate_shipping_label'],
    });
  }
}
```

---

## 7. Integração de Frete (Melhor Envio)

```typescript
// POST /api/shipping/quote
async function getShippingQuotes(req: Request) {
  const { cep, items } = req.body;

  // 1. Calcular peso e dimensões do pacote
  const packageInfo = calculatePackage(items);
  // Gráfica: peso é baseado em (gramatura × área × quantidade) + embalagem

  // 2. Consultar Melhor Envio
  const response = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.MELHOR_ENVIO_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Kairos Grafica (contato@kairos.com.br)',
    },
    body: JSON.stringify({
      from: { postal_code: env.WAREHOUSE_CEP }, // CEP da gráfica
      to: { postal_code: cep },
      products: [{
        id: 'package',
        width: packageInfo.width,   // cm
        height: packageInfo.height, // cm
        length: packageInfo.length, // cm
        weight: packageInfo.weight, // kg
        insurance_value: packageInfo.declaredValue,
        quantity: 1,
      }],
    }),
  });

  const quotes = await response.json();

  // 3. Filtrar e formatar (remover opções com erro)
  return quotes
    .filter((q: any) => !q.error)
    .map((q: any) => ({
      id: q.id,
      name: q.name,               // "SEDEX", "PAC", "Jadlog .Package"
      company: q.company.name,
      price: parseFloat(q.price),
      deliveryDays: q.delivery_range.max, // Pior caso
      deliveryRange: `${q.delivery_range.min}-${q.delivery_range.max} dias úteis`,
    }))
    .sort((a, b) => a.price - b.price); // Mais barato primeiro
}

// Cálculo de peso para produtos gráficos
function calculatePackage(items: CartItem[]): PackageInfo {
  let totalWeightGrams = 0;

  for (const item of items) {
    const { width_mm, height_mm } = item.config.format;
    const gsm = item.config.paper.weight_gsm;          // gramas por m²
    const sheets = item.quantity;

    // Peso = (área em m²) × gramatura × quantidade
    const areaM2 = (width_mm / 1000) * (height_mm / 1000);
    totalWeightGrams += areaM2 * gsm * sheets;
  }

  // Adicionar peso da embalagem (~200g para caixa)
  totalWeightGrams += 200;

  return {
    weight: totalWeightGrams / 1000, // Converter para kg
    width: 35,   // cm (dimensão padrão da caixa)
    height: 15,
    length: 45,
    declaredValue: items.reduce((sum, i) => sum + i.calculated_price, 0),
  };
}
```

---

## 8. Segurança em Camadas

### 8.1. Mapa de Segurança

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA 1: EDGE (Cloudflare)                   │
│  ✓ DDoS Protection (automático, >100Tbps de capacidade)         │
│  ✓ WAF Rules (SQL injection, XSS, path traversal)               │
│  ✓ Bot Management (bloqueia scrapers de preço)                   │
│  ✓ SSL/TLS Full Strict (end-to-end encryption)                   │
│  ✓ Rate Limiting (por IP: 100 req/min geral, 10/min em /api/*)  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA 2: APLICAÇÃO (Express)                 │
│  ✓ Helmet.js (Security headers: CSP, HSTS, X-Frame-Options)     │
│  ✓ CORS restrito (somente domínio kairos.com.br)                │
│  ✓ Input validation com Zod em TODA rota (nunca confiar no FE)  │
│  ✓ Sanitização de strings (xss-clean)                            │
│  ✓ Rate limit por rota sensível (login: 5/min, checkout: 3/min) │
│  ✓ CSRF token para mutations (POST/PUT/DELETE)                   │
│  ✓ Request size limit (body: 1MB, exceto upload que vai direto)  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA 3: DADOS                               │
│  ✓ Senhas: Argon2id (memory-hard, resistente a GPU brute-force) │
│  ✓ CPF/CNPJ: Encriptação AES-256-GCM em repouso                │
│  ✓ Tokens JWT: RS256 (assimétrico) com rotação de chaves        │
│  ✓ Session: HttpOnly + Secure + SameSite=Strict cookies         │
│  ✓ SQL: Drizzle ORM (parametrizado, sem SQL injection possível)  │
│  ✓ Backups automáticos: Neon faz point-in-time recovery          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA 4: PAGAMENTO                           │
│  ✓ PCI DSS: Cartão tokenizado no frontend (SDK Mercado Pago)    │
│  ✓ Número do cartão NUNCA toca nosso servidor                    │
│  ✓ Webhook validado por HMAC-SHA256                              │
│  ✓ Pagamento sempre confirmado via API (nunca confiar no body)   │
│  ✓ Idempotência: webhook duplicado não processa duas vezes       │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2. Proteção Anti-Fraude no Preço

```typescript
// Middleware: Toda adição ao carrinho passa por aqui
async function validateCartPrice(req: Request, res: Response, next: NextFunction) {
  const { productId, config, quantity, clientPrice } = req.body;

  // 1. Recalcular server-side
  const serverPrice = await calculateServerPrice(productId, config, quantity);

  // 2. Comparar com tolerância de centavo (arredondamento float)
  const diff = Math.abs(clientPrice - serverPrice);

  if (diff > 0.01) {
    // Log para investigação (pode ser bug ou fraude)
    logger.warn('Price mismatch', {
      productId,
      clientPrice,
      serverPrice,
      diff,
      ip: req.ip,
      userId: req.session?.userId,
    });

    return res.status(422).json({
      error: 'PRICE_MISMATCH',
      message: 'O preço calculado não confere. Atualize a página e tente novamente.',
      correctPrice: serverPrice,
    });
  }

  // 3. Assinar o preço validado (HMAC) para que não seja alterável no carrinho
  req.validatedPrice = serverPrice;
  req.priceSignature = hmacSign(JSON.stringify({ productId, config, quantity, serverPrice }));

  next();
}
```

---

## 9. Performance e Otimização

### 9.1. Estratégia de Cache (3 Camadas)

```
┌──────────────────────────────────────────────────┐
│            CAMADA 1: BROWSER (Client)             │
│                                                    │
│  TanStack Query:                                   │
│  ├── Catálogo de produtos: staleTime = 5 min      │
│  ├── Tabelas de preço: staleTime = 10 min         │
│  ├── Opções de papel/acabamento: staleTime = 1h   │
│  └── Carrinho: staleTime = 0 (sempre fresco)      │
│                                                    │
│  Service Worker (opcional):                        │
│  └── Cache de imagens de produtos offline          │
└──────────────────────────────────────────────────┘
                      │ cache miss
                      ▼
┌──────────────────────────────────────────────────┐
│            CAMADA 2: EDGE (Upstash Redis)         │
│                                                    │
│  ├── Catálogo completo: TTL = 15 min              │
│  ├── Cotação de frete por CEP: TTL = 30 min       │
│  ├── Sessões de carrinho: TTL = 7 dias            │
│  └── Rate limit counters: TTL = 1 min             │
│                                                    │
│  Invalidação: Webhook do admin ao alterar produto  │
└──────────────────────────────────────────────────┘
                      │ cache miss
                      ▼
┌──────────────────────────────────────────────────┐
│            CAMADA 3: DATABASE (PostgreSQL)         │
│                                                    │
│  Índices otimizados:                               │
│  ├── products: (category_id, active) → catálogo   │
│  ├── product_variants: (product_id) → configs     │
│  ├── orders: (customer_id, status) → histórico    │
│  ├── cart_items: (session_id) → carrinho          │
│  └── price_rules: (product_id, min_qty) → preço  │
│                                                    │
│  Connection pooling: Neon Serverless Driver        │
│  (HTTP-based, sem TCP overhead no Workers)         │
└──────────────────────────────────────────────────┘
```

### 9.2. Frontend Performance Budget

| Métrica | Alvo | Estratégia |
|---------|------|-----------|
| **LCP** | <2.5s | Imagens de produto em WebP/AVIF via Cloudflare Image Resizing |
| **FID** | <100ms | Price engine em WebWorker; React 19 concurrent features |
| **CLS** | <0.1 | Skeleton loaders com dimensões fixas; `aspect-ratio` em imagens |
| **Bundle (gráfica)** | <150KB gz | Code splitting: `/grafica/*` rotas carregam sob demanda |
| **TTI** | <3.5s | Tabelas de preço pré-carregadas no `prefetch` da rota |

### 9.3. Code Splitting por Rota

```typescript
// No App.tsx (Wouter routes)
import { lazy, Suspense } from 'react';

// Landing page (já existente — não muda)
import Home from './pages/home';

// Módulo gráfica (carregado sob demanda)
const GraficaCatalogo = lazy(() => import('./pages/grafica/catalogo'));
const GraficaProduto = lazy(() => import('./pages/grafica/produto'));
const GraficaCarrinho = lazy(() => import('./pages/grafica/carrinho'));
const GraficaCheckout = lazy(() => import('./pages/grafica/checkout'));
const GraficaPedido = lazy(() => import('./pages/grafica/pedido'));
const GraficaConta = lazy(() => import('./pages/grafica/conta'));

// Cada rota /grafica/* carrega ~40-80KB adicionais (não afeta landing page)
```

---

## 10. Estrutura de Rotas da API

### 10.1. API REST (Express)

```
PÚBLICAS (sem autenticação)
├── GET    /api/categories                    → Lista categorias ativas
├── GET    /api/categories/:slug              → Categoria + produtos
├── GET    /api/products/:slug                → Produto + variantes + preços
├── GET    /api/products/:slug/price-table    → Tabela de preços completa (para WebWorker)
│
├── POST   /api/cart                          → Criar carrinho (retorna session_id)
├── GET    /api/cart/:sessionId               → Obter carrinho
├── POST   /api/cart/:sessionId/items         → Adicionar item (com validação de preço)
├── PATCH  /api/cart/:sessionId/items/:id     → Atualizar quantidade
├── DELETE /api/cart/:sessionId/items/:id     → Remover item
│
├── POST   /api/upload/request                → Solicitar signed URL para upload
├── POST   /api/upload/confirm                → Confirmar upload e iniciar validação
│
├── POST   /api/shipping/quote                → Cotação de frete (CEP + items)
├── GET    /api/address/:cep                  → Busca endereço via ViaCEP (proxy com cache)

AUTENTICADAS (customer)
├── POST   /api/auth/register                 → Criar conta
├── POST   /api/auth/login                    → Login (retorna JWT)
├── POST   /api/auth/forgot-password          → Enviar email de recuperação
├── POST   /api/auth/reset-password           → Redefinir senha com token
│
├── GET    /api/account/profile               → Dados do cliente
├── PATCH  /api/account/profile               → Atualizar dados
├── GET    /api/account/addresses             → Listar endereços
├── POST   /api/account/addresses             → Adicionar endereço
├── DELETE /api/account/addresses/:id         → Remover endereço
├── GET    /api/account/orders                → Histórico de pedidos
├── GET    /api/account/orders/:id            → Detalhes do pedido
│
├── POST   /api/checkout                      → Criar pedido a partir do carrinho
├── POST   /api/checkout/:orderId/payment     → Processar pagamento

WEBHOOKS (verificação HMAC)
├── POST   /api/webhooks/mercadopago          → Notificações de pagamento

ADMIN (autenticação separada — tabela users existente)
├── GET    /api/admin/orders                  → Listar pedidos (com filtros)
├── PATCH  /api/admin/orders/:id/status       → Atualizar status
├── PATCH  /api/admin/orders/:id/tracking     → Adicionar código de rastreio
├── GET    /api/admin/orders/:id/art          → Baixar arte do pedido
├── PATCH  /api/admin/orders/:id/art-status   → Aprovar/rejeitar arte
│
├── CRUD   /api/admin/products                → Gerenciar produtos
├── CRUD   /api/admin/categories              → Gerenciar categorias
├── CRUD   /api/admin/paper-types             → Gerenciar tipos de papel
├── CRUD   /api/admin/finishings              → Gerenciar acabamentos
├── CRUD   /api/admin/price-rules             → Gerenciar regras de preço
```

---

## 11. Estrutura de Diretórios (Novas Adições)

```
kairos-landingpage/
├── client/src/
│   ├── components/
│   │   ├── ui/                        # shadcn (existente)
│   │   ├── layout.tsx                 # Navbar + Footer (existente)
│   │   └── grafica/                   # ← NOVO
│   │       ├── product-card.tsx       # Card do catálogo
│   │       ├── product-configurator.tsx # O configurador completo
│   │       ├── price-display.tsx      # Exibição de preço em tempo real
│   │       ├── paper-selector.tsx     # Seletor de papel
│   │       ├── finishing-selector.tsx # Seletor de acabamento
│   │       ├── quantity-selector.tsx  # Seletor de quantidade
│   │       ├── format-selector.tsx    # Seletor de formato
│   │       ├── color-selector.tsx     # Seletor de cores (4x0, 4x4...)
│   │       ├── file-uploader.tsx      # Upload de arte com drag & drop
│   │       ├── art-preview.tsx        # Preview do arquivo enviado
│   │       ├── cart-drawer.tsx        # Drawer lateral do carrinho
│   │       ├── cart-item.tsx          # Item do carrinho
│   │       ├── checkout-steps.tsx     # Steps do checkout
│   │       ├── shipping-options.tsx   # Opções de frete
│   │       ├── payment-form.tsx       # Formulário de pagamento
│   │       └── order-tracker.tsx      # Acompanhamento do pedido
│   │
│   ├── pages/
│   │   ├── home.tsx                   # Landing page (existente)
│   │   └── grafica/                   # ← NOVO
│   │       ├── catalogo.tsx           # /grafica — grid de categorias/produtos
│   │       ├── produto.tsx            # /grafica/:slug — configurador
│   │       ├── carrinho.tsx           # /grafica/carrinho
│   │       ├── checkout.tsx           # /grafica/checkout
│   │       ├── pedido.tsx             # /grafica/pedido/:id — confirmação
│   │       └── conta.tsx              # /grafica/conta — painel do cliente
│   │
│   ├── workers/
│   │   └── price-engine.worker.ts     # ← NOVO — WebWorker de cálculo
│   │
│   ├── hooks/
│   │   ├── use-lenis.ts              # (existente)
│   │   └── grafica/                   # ← NOVO
│   │       ├── use-cart.ts            # Estado global do carrinho
│   │       ├── use-price-calculator.ts # Interface com o WebWorker
│   │       ├── use-file-upload.ts     # Lógica de upload para R2
│   │       └── use-shipping.ts        # Cotação de frete
│   │
│   └── lib/
│       ├── utils.ts                   # (existente)
│       └── grafica/                    # ← NOVO
│           ├── price-formulas.ts      # Fórmulas compartilhadas (FE + Worker)
│           ├── validators.ts          # Schemas Zod para formulários
│           └── constants.ts           # Enums, steps do checkout, etc.
│
├── server/
│   ├── routes.ts                      # Registro de rotas (existente, expandir)
│   ├── routes/                        # ← NOVO
│   │   ├── catalog.ts                 # GET /api/categories, /api/products
│   │   ├── cart.ts                    # CRUD /api/cart
│   │   ├── upload.ts                  # Upload flow
│   │   ├── shipping.ts               # Cotação de frete
│   │   ├── checkout.ts               # Checkout + pagamento
│   │   ├── auth.ts                   # Autenticação de clientes
│   │   ├── account.ts                # Painel do cliente
│   │   ├── webhooks.ts               # Mercado Pago webhooks
│   │   └── admin/                    # Rotas administrativas
│   │       ├── orders.ts
│   │       ├── products.ts
│   │       └── settings.ts
│   │
│   ├── services/                      # ← NOVO — Lógica de negócio
│   │   ├── price.service.ts           # Cálculo de preço server-side
│   │   ├── payment.service.ts         # Integração Mercado Pago
│   │   ├── shipping.service.ts        # Integração Melhor Envio
│   │   ├── upload.service.ts          # Signed URLs + validação
│   │   ├── email.service.ts           # Templates + envio via Resend
│   │   └── art-validation.service.ts  # Validação de arte (DPI, CMYK)
│   │
│   ├── middleware/                     # ← NOVO
│   │   ├── auth.ts                    # JWT verification
│   │   ├── admin.ts                   # Admin-only guard
│   │   ├── rate-limit.ts             # Rate limiting por rota
│   │   ├── validate.ts               # Zod validation middleware
│   │   └── price-guard.ts            # Anti-fraude de preço
│   │
│   └── queue/                         # ← NOVO — Processamento async
│       ├── handlers.ts                # Handler do Cloudflare Queue
│       ├── send-email.ts
│       ├── validate-art.ts
│       └── generate-label.ts
│
├── shared/
│   ├── schema.ts                      # Drizzle schema (expandir com novas tabelas)
│   └── types.ts                       # ← NOVO — Types compartilhados FE/BE
│
└── scripts/
    └── seed-products.ts               # ← NOVO — Seed de produtos iniciais
```

---

## 12. Fluxo Completo de um Pedido (Revisado)

```
┌───┐  ┌──────────────────────────────────────────────────────────────┐
│ 1 │  │ NAVEGAÇÃO                                                     │
│   │  │ Cliente acessa /grafica → Vê categorias (Panfletos, Cartões, │
│   │  │ Banners...) → Clica em "Panfletos" → Grid de variações       │
└─┬─┘  └──────────────────────────────────────────────────────────────┘
  │
┌─▼─┐  ┌──────────────────────────────────────────────────────────────┐
│ 2 │  │ CONFIGURAÇÃO                                                  │
│   │  │ Seleciona Panfleto A5 → Configurador abre:                   │
│   │  │ • Papel: Couché 115g (lista vem da API, cached 10min)        │
│   │  │ • Cores: 4×4 (frente e verso coloridos)                      │
│   │  │ • Acabamento: Laminação Fosca                                 │
│   │  │ • Quantidade: 2000un (slider com steps pré-definidos)        │
│   │  │                                                               │
│   │  │ WebWorker calcula em <5ms: R$ 189,90 (R$ 0.09/un)           │
│   │  │ Preview: mockup 3D do panfleto com as specs selecionadas     │
└─┬─┘  └──────────────────────────────────────────────────────────────┘
  │
┌─▼─┐  ┌──────────────────────────────────────────────────────────────┐
│ 3 │  │ UPLOAD DE ARTE                                                │
│   │  │ Drag & drop do PDF → Frontend pede signed URL ao backend →   │
│   │  │ Upload direto para R2 (barra de progresso) → Backend valida: │
│   │  │ • Magic bytes ✓ (é realmente PDF)                            │
│   │  │ • DPI ≥ 150 ✓ (qualidade de impressão)                      │
│   │  │ • Sangria: 3mm ✓ (margem de corte)                          │
│   │  │ • Colorspace: CMYK ✓ (ou aviso se RGB)                      │
│   │  │ Thumbnail gerado e exibido ao cliente                        │
└─┬─┘  └──────────────────────────────────────────────────────────────┘
  │
┌─▼─┐  ┌──────────────────────────────────────────────────────────────┐
│ 4 │  │ CARRINHO                                                      │
│   │  │ "Adicionar ao carrinho" → Backend RECALCULA o preço →        │
│   │  │ Preço confere? SIM → Item adicionado com assinatura HMAC     │
│   │  │ Drawer lateral abre mostrando: thumbnail + specs + preço     │
│   │  │ Cliente pode continuar comprando ou ir ao checkout            │
└─┬─┘  └──────────────────────────────────────────────────────────────┘
  │
┌─▼─┐  ┌──────────────────────────────────────────────────────────────┐
│ 5 │  │ CHECKOUT (multi-step)                                         │
│   │  │ Step 1 — Identificação: Email + CPF + Nome + Tel             │
│   │  │   (se já tem conta, preenche automático)                     │
│   │  │ Step 2 — Endereço: CEP → autocomplete via ViaCEP            │
│   │  │ Step 3 — Frete: Melhor Envio retorna opções em ~800ms       │
│   │  │   PAC: R$18,90 (8-12 dias) | SEDEX: R$32,50 (3-5 dias)     │
│   │  │ Step 4 — Pagamento: Pix / Boleto / Cartão                   │
│   │  │   Cartão tokenizado no frontend (PCI compliant)              │
│   │  │   Pix: QR Code gerado em tela + copia-e-cola                │
└─┬─┘  └──────────────────────────────────────────────────────────────┘
  │
┌─▼─┐  ┌──────────────────────────────────────────────────────────────┐
│ 6 │  │ CONFIRMAÇÃO                                                   │
│   │  │ Pagamento aprovado → Webhook MP → Backend:                   │
│   │  │ • Muda status: "Pago — Aguardando Produção"                  │
│   │  │ • Enfileira email de confirmação (Cloudflare Queue → Resend) │
│   │  │ • Notifica admin no painel                                    │
│   │  │ • Gera etiqueta de frete via Melhor Envio                    │
│   │  │                                                               │
│   │  │ Cliente vê página /grafica/pedido/12345 com:                 │
│   │  │ • Timeline visual do status                                   │
│   │  │ • Código de rastreio (quando disponível)                     │
│   │  │ • Link para baixar 2ª via do boleto (se aplicável)           │
└───┘  └──────────────────────────────────────────────────────────────┘
```

---

## 13. Estimativa de Custos Operacionais (Mensal)

| Serviço | Plano | Custo/mês | Limite |
|---------|-------|-----------|--------|
| **Cloudflare Workers** | Free → Paid ($5) | R$0 — R$30 | 100K req/dia free; $5 = 10M req |
| **Cloudflare R2** | Free tier | R$0 | 10GB storage + 1M reads grátis |
| **Cloudflare Queues** | Included | R$0 | 1M msgs/mês grátis |
| **Neon PostgreSQL** | Free → Launch | R$0 — R$100 | 0.5GB free; Launch = 10GB |
| **Upstash Redis** | Free | R$0 | 10K commands/dia grátis |
| **Resend** | Free | R$0 | 3000 emails/mês + 100/dia |
| **Sentry** | Free | R$0 | 5K errors/mês |
| **Melhor Envio** | API | R$0 | Sem mensalidade (cobra no frete) |
| **Mercado Pago** | — | ~3.5-5% por transação | Taxa sobre vendas |
| **TOTAL (início)** | — | **~R$0/mês** | Para até ~1000 pedidos/mês |
| **TOTAL (escala)** | — | **~R$130/mês** | Para até ~10.000 pedidos/mês |

---

## 14. Roadmap de Implementação

### Fase 1 — Fundação (Semanas 1-2)
- [ ] Schema do banco de dados (Drizzle migrations)
- [ ] Seed de categorias, produtos, papéis, acabamentos
- [ ] API de catálogo (GET categories, products)
- [ ] Rotas do frontend (`/grafica/*`)
- [ ] Página de catálogo com grid de categorias

### Fase 2 — Configurador (Semanas 3-4)
- [ ] Componentes do configurador (papel, cor, acabamento, formato, quantidade)
- [ ] WebWorker de cálculo de preço
- [ ] Página de produto com configurador funcional
- [ ] Carrinho (frontend state + API)

### Fase 3 — Upload e Validação (Semana 5)
- [ ] Integração R2 (signed URLs)
- [ ] Componente de upload com drag & drop e progresso
- [ ] Validação de arte server-side (magic bytes, DPI, sangria)
- [ ] Geração de thumbnail

### Fase 4 — Checkout e Pagamento (Semanas 6-7)
- [ ] Fluxo de checkout multi-step
- [ ] Integração ViaCEP
- [ ] Integração Melhor Envio
- [ ] Integração Mercado Pago (Pix + Boleto + Cartão)
- [ ] Webhooks de confirmação
- [ ] Emails transacionais (Resend)

### Fase 5 — Admin e Pós-Venda (Semanas 8-9)
- [ ] Painel admin (listar pedidos, aprovar artes, atualizar status)
- [ ] Painel do cliente (histórico, rastreio)
- [ ] Geração de etiqueta de frete (Melhor Envio)
- [ ] Notificações de status por email

### Fase 6 — Polimento (Semana 10)
- [ ] Testes E2E (Playwright)
- [ ] Monitoramento (Sentry)
- [ ] SEO (meta tags, sitemap, structured data para produtos)
- [ ] Performance audit (Lighthouse)
- [ ] Security audit final

---

## 15. Considerações Finais

### Vantagens desta Arquitetura vs. a Proposta Original

1. **Zero migração**: Nenhuma linha do site atual precisa ser reescrita
2. **Custo ~R$0 para começar**: Toda a infraestrutura tem free tier generoso
3. **Edge-first**: Tudo roda na borda da Cloudflare — latência mínima para qualquer região do Brasil
4. **Controle total**: Sem dependência de framework de e-commerce (Medusa) que limita customização
5. **Segurança em 4 camadas**: Da borda (Cloudflare WAF) até o dado (AES-256)
6. **Performance garantida**: WebWorker para cálculos, code splitting para rotas, cache em 3 níveis
7. **Escalabilidade horizontal**: Workers escala automaticamente, Neon serverless escala sob demanda

### Quando Considerar Medusa.js no Futuro
Se o e-commerce crescer para +50 SKUs com lógica genérica (como camisetas, canecas), pode fazer sentido adicionar Medusa como microserviço separado para esses produtos "simples", mantendo o configurador customizado para os produtos gráficos.
