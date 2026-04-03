import { useEffect, useRef } from "react";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const FB_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

let gaLoaded = false;
let fbLoaded = false;

function loadGA() {
  if (gaLoaded || !GA_ID) return;
  gaLoaded = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
}

function loadFB() {
  if (fbLoaded || !FB_ID) return;
  fbLoaded = true;

  window.fbq = function () {
    (window.fbq as any).callMethod
      ? (window.fbq as any).callMethod.apply(window.fbq, arguments)
      : (window.fbq as any).queue.push(arguments);
  };
  (window.fbq as any).push = window.fbq;
  (window.fbq as any).loaded = true;
  (window.fbq as any).version = "2.0";
  (window.fbq as any).queue = [];

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq("init", FB_ID);
  window.fbq("track", "PageView");
}

export function trackPageView(path: string) {
  if (GA_ID && window.gtag) {
    window.gtag("event", "page_view", { page_path: path });
  }
  if (FB_ID && window.fbq) {
    window.fbq("track", "PageView");
  }
}

export function trackEvent(name: string, params?: Record<string, any>) {
  if (GA_ID && window.gtag) {
    window.gtag("event", name, params);
  }
  if (FB_ID && window.fbq) {
    window.fbq("trackCustom", name, params);
  }
}

export function trackPurchase(orderId: string, total: number, items?: { id: string; name: string; price: number; quantity: number }[]) {
  if (GA_ID && window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: orderId,
      value: total,
      currency: "BRL",
      items: items?.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })),
    });
  }
  if (FB_ID && window.fbq) {
    window.fbq("track", "Purchase", {
      value: total,
      currency: "BRL",
      content_ids: items?.map((i) => i.id),
      content_type: "product",
    });
  }
}

export function trackAddToCart(productId: string, price: number) {
  if (GA_ID && window.gtag) {
    window.gtag("event", "add_to_cart", {
      currency: "BRL",
      value: price,
      items: [{ item_id: productId, price }],
    });
  }
  if (FB_ID && window.fbq) {
    window.fbq("track", "AddToCart", {
      value: price,
      currency: "BRL",
      content_ids: [productId],
      content_type: "product",
    });
  }
}

export function trackBeginCheckout(total: number) {
  if (GA_ID && window.gtag) {
    window.gtag("event", "begin_checkout", { currency: "BRL", value: total });
  }
  if (FB_ID && window.fbq) {
    window.fbq("track", "InitiateCheckout", { value: total, currency: "BRL" });
  }
}

/**
 * Hook to initialize analytics scripts.
 * Call once in the App component.
 */
export function useAnalyticsInit() {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadGA();
    loadFB();
  }, []);
}
