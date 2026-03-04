import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense, lazy } from "react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import { useLenis } from "@/hooks/use-lenis";
import { Skeleton } from "@/components/ui/skeleton";

const GraficaCatalogo = lazy(() => import("./pages/grafica/catalogo"));
const GraficaCategoria = lazy(() => import("./pages/grafica/categoria"));
const GraficaProduto = lazy(() => import("./pages/grafica/produto"));
const GraficaCarrinho = lazy(() => import("./pages/grafica/carrinho"));
const GraficaCheckout = lazy(() => import("./pages/grafica/checkout"));
const GraficaPedido = lazy(() => import("./pages/grafica/pedido"));
const GraficaConta = lazy(() => import("./pages/grafica/conta"));
const GraficaLogin = lazy(() => import("./pages/grafica/login"));
const AdminLogin = lazy(() => import("./pages/admin/login"));
const AdminLayout = lazy(() => import("./pages/admin/layout"));

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/grafica">
        <Suspense fallback={<GraficaLoading />}>
          <GraficaCatalogo />
        </Suspense>
      </Route>
      <Route path="/grafica/produto/:slug">
        {(params) => (
          <Suspense fallback={<GraficaLoading />}>
            <GraficaProduto slug={params.slug} />
          </Suspense>
        )}
      </Route>
      <Route path="/grafica/carrinho">
        <Suspense fallback={<GraficaLoading />}>
          <GraficaCarrinho />
        </Suspense>
      </Route>
      <Route path="/grafica/checkout">
        <Suspense fallback={<GraficaLoading />}>
          <GraficaCheckout />
        </Suspense>
      </Route>
      <Route path="/grafica/pedido/:id">
        {(params) => (
          <Suspense fallback={<GraficaLoading />}>
            <GraficaPedido id={params.id} />
          </Suspense>
        )}
      </Route>
      <Route path="/grafica/login">
        <Suspense fallback={<GraficaLoading />}>
          <GraficaLogin />
        </Suspense>
      </Route>
      <Route path="/grafica/conta">
        <Suspense fallback={<GraficaLoading />}>
          <GraficaConta />
        </Suspense>
      </Route>
      <Route path="/admin" nest>
        <Suspense fallback={<GraficaLoading />}>
          <AdminLayout />
        </Suspense>
      </Route>
      <Route path="/grafica/:slug">
        {(params) => (
          <Suspense fallback={<GraficaLoading />}>
            <GraficaCategoria slug={params.slug} />
          </Suspense>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useLenis();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
