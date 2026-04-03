import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense, lazy, useEffect } from "react";
import NotFound from "@/pages/not-found";
import { useLenis } from "@/hooks/use-lenis";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsInit, trackPageView } from "@/hooks/use-analytics";
import { ErrorBoundary } from "@/components/error-boundary";

const GraficaCatalogo = lazy(() => import("./pages/grafica/catalogo"));
const GraficaCategoria = lazy(() => import("./pages/grafica/categoria"));
const GraficaProduto = lazy(() => import("./pages/grafica/produto"));
const GraficaCarrinho = lazy(() => import("./pages/grafica/carrinho"));
const GraficaCheckout = lazy(() => import("./pages/grafica/checkout"));
const GraficaPedido = lazy(() => import("./pages/grafica/pedido"));
const GraficaConta = lazy(() => import("./pages/grafica/conta"));
const GraficaLogin = lazy(() => import("./pages/grafica/login"));
const GraficaFAQ = lazy(() => import("./pages/grafica/faq"));
const GraficaTermos = lazy(() => import("./pages/grafica/termos"));
const GraficaPrivacidade = lazy(() => import("./pages/grafica/privacidade"));

function GraficaLoading() {
  return (
    <div className="min-h-screen bg-background pt-24 px-6">
      <div className="container mx-auto max-w-6xl space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function Analytics() {
  const [location] = useLocation();
  useEffect(() => {
    trackPageView(location);
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <Analytics />
      <Switch>
        <Route path="/">
          <ErrorBoundary>
            <Suspense fallback={<GraficaLoading />}>
              <GraficaCatalogo />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/grafica">
          <ErrorBoundary>
            <Suspense fallback={<GraficaLoading />}>
              <GraficaCatalogo />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/grafica/produto/:slug">
          {(params) => (
            <ErrorBoundary>
              <Suspense fallback={<GraficaLoading />}>
                <GraficaProduto slug={params.slug} />
              </Suspense>
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/grafica/carrinho">
          <ErrorBoundary>
            <Suspense fallback={<GraficaLoading />}>
              <GraficaCarrinho />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/grafica/checkout">
          <ErrorBoundary>
            <Suspense fallback={<GraficaLoading />}>
              <GraficaCheckout />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/grafica/pedido/:id">
          {(params) => (
            <ErrorBoundary>
              <Suspense fallback={<GraficaLoading />}>
                <GraficaPedido id={params.id} />
              </Suspense>
            </ErrorBoundary>
          )}
        </Route>
        <Route path="/grafica/login">
          <ErrorBoundary>
            <Suspense fallback={<GraficaLoading />}>
              <GraficaLogin />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/grafica/conta">
          <ErrorBoundary>
            <Suspense fallback={<GraficaLoading />}>
              <GraficaConta />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/grafica/faq">
          <ErrorBoundary>
            <Suspense fallback={<GraficaLoading />}>
              <GraficaFAQ />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/grafica/termos">
          <ErrorBoundary>
            <Suspense fallback={<GraficaLoading />}>
              <GraficaTermos />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/grafica/privacidade">
          <ErrorBoundary>
            <Suspense fallback={<GraficaLoading />}>
              <GraficaPrivacidade />
            </Suspense>
          </ErrorBoundary>
        </Route>
        <Route path="/grafica/:slug">
          {(params) => (
            <ErrorBoundary>
              <Suspense fallback={<GraficaLoading />}>
                <GraficaCategoria slug={params.slug} />
              </Suspense>
            </ErrorBoundary>
          )}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  useLenis();
  useAnalyticsInit();

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
