/**
 * MercadoPago Checkout Pro Service
 *
 * Based on official MercadoPago SDK v2 for Node.js:
 * https://github.com/mercadopago/sdk-nodejs
 *
 * Flow:
 * 1. createPreference() — creates a checkout preference with items, back_urls, notification_url
 * 2. getPayment() — fetches payment details by ID (used in webhook handler)
 */

import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

if (!process.env.MP_ACCESS_TOKEN) {
  console.warn("[MercadoPago] MP_ACCESS_TOKEN is not set. Payment integration will fail.");
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "",
  options: { timeout: 10000 },
});

const preferenceClient = new Preference(client);
const paymentClient = new Payment(client);

// Remove trailing slash to avoid double-slash in URLs (e.g. notification_url)
const SITE_URL = (process.env.SITE_URL || "http://localhost:5000").replace(/\/+$/, "");

interface PreferenceItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
}

interface CreatePreferenceInput {
  orderId: string;
  items: PreferenceItem[];
  shippingCost: number;
  payer: {
    name: string;
    email: string;
    phone?: string;
  };
}

/**
 * Creates a MercadoPago Checkout Pro preference.
 *
 * Official docs: https://www.mercadopago.com.br/developers/en/docs/checkout-pro/create-payment-preference
 *
 * Returns the preference id, init_point (production) and sandbox_init_point (testing).
 */
export async function createPreference(input: CreatePreferenceInput) {
  const { orderId, items, shippingCost, payer } = input;

  const mpItems = items.map((item) => ({
    id: item.id,
    title: item.title,
    quantity: item.quantity,
    unit_price: item.unit_price,
    currency_id: "BRL" as const,
  }));

  // Add shipping as a separate item if > 0
  if (shippingCost > 0) {
    mpItems.push({
      id: "shipping",
      title: "Frete",
      quantity: 1,
      unit_price: parseFloat(shippingCost.toFixed(2)),
      currency_id: "BRL" as const,
    });
  }

  // notification_url must be a publicly accessible HTTPS URL.
  // Skip it in local development (localhost) to avoid preference creation failure.
  const isLocalDev = SITE_URL.includes("localhost") || SITE_URL.includes("127.0.0.1");

  const preferenceBody: Record<string, any> = {
    items: mpItems,
    payer: {
      name: payer.name,
      email: payer.email,
    },
    back_urls: {
      success: `${SITE_URL}/grafica/pedido/${orderId}?mp_status=approved`,
      failure: `${SITE_URL}/grafica/pedido/${orderId}?mp_status=rejected`,
      pending: `${SITE_URL}/grafica/pedido/${orderId}?mp_status=pending`,
    },
    external_reference: orderId,
    statement_descriptor: "KAIROS GRAFICA",
  };

  if (!isLocalDev) {
    // auto_return requires back_urls to be publicly accessible (not localhost)
    preferenceBody.auto_return = "all";
    preferenceBody.notification_url = `${SITE_URL}/api/webhooks/mercadopago`;
    preferenceBody.expires = true;
    preferenceBody.expiration_date_to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  // Detect sandbox mode: test tokens start with APP_USR- or TEST-
  const mpToken = process.env.MP_ACCESS_TOKEN || "";
  const isSandbox = mpToken.startsWith("TEST-") || mpToken.startsWith("APP_USR-");

  console.log("[MercadoPago] Creating preference for order:", orderId, "| isLocal:", isLocalDev, "| sandbox:", isSandbox);

  const result = await preferenceClient.create({ body: preferenceBody as any });

  // Return the correct checkout URL based on environment
  // In sandbox, initPoint goes to production (broken with test token)
  // sandboxInitPoint goes to sandbox (correct for testing)
  const checkoutUrl = isSandbox
    ? (result.sandbox_init_point || result.init_point!)
    : result.init_point!;

  return {
    preferenceId: result.id!,
    initPoint: checkoutUrl,
    sandboxInitPoint: result.sandbox_init_point!,
  };
}

/**
 * Fetches payment details from MercadoPago by payment ID.
 *
 * IMPORTANT: Always fetch from the API — never trust the webhook body directly.
 *
 * Official docs: https://www.mercadopago.com.br/developers/en/reference/payments/_payments_id/get
 */
export async function getPayment(paymentId: string) {
  const payment = await paymentClient.get({ id: paymentId });

  return {
    id: payment.id,
    status: payment.status as string,
    statusDetail: payment.status_detail as string,
    externalReference: payment.external_reference as string,
    transactionAmount: payment.transaction_amount as number,
    paymentMethodId: payment.payment_method_id as string,
    paymentTypeId: payment.payment_type_id as string,
    dateApproved: payment.date_approved as string | null,
  };
}

/**
 * Maps MercadoPago payment status to our internal order/payment statuses.
 *
 * MP statuses: approved, pending, in_process, rejected, cancelled, refunded, charged_back
 * Our order statuses: pending, confirmed, production, shipped, delivered, cancelled
 * Our payment statuses: pending, approved, rejected
 */
export function mapPaymentStatus(mpStatus: string): {
  orderStatus: string;
  paymentStatus: string;
} {
  switch (mpStatus) {
    case "approved":
      return { orderStatus: "confirmed", paymentStatus: "approved" };
    case "pending":
    case "in_process":
    case "authorized":
      return { orderStatus: "pending", paymentStatus: "pending" };
    case "rejected":
      return { orderStatus: "pending", paymentStatus: "rejected" };
    case "cancelled":
      return { orderStatus: "cancelled", paymentStatus: "rejected" };
    case "refunded":
    case "charged_back":
      return { orderStatus: "cancelled", paymentStatus: "rejected" };
    default:
      return { orderStatus: "pending", paymentStatus: "pending" };
  }
}

/**
 * Maps MercadoPago payment_type_id to a human-readable method name.
 */
export function mapPaymentMethod(paymentTypeId: string): string {
  switch (paymentTypeId) {
    case "credit_card":
      return "card";
    case "debit_card":
      return "card";
    case "bank_transfer":
      return "pix";
    case "ticket":
      return "boleto";
    case "account_money":
      return "mercadopago";
    default:
      return "mercadopago";
  }
}
