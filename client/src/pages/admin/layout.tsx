import { Switch, Route, Redirect, useLocation } from "wouter";
import { Suspense, lazy } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import AdminSidebar from "@/components/admin/admin-sidebar";
import AdminHeader from "@/components/admin/admin-header";
import { Skeleton } from "@/components/ui/skeleton";

const AdminLogin = lazy(() => import("./login"));
const Dashboard = lazy(() => import("./dashboard"));
const OrdersList = lazy(() => import("./orders/index"));
const OrderDetail = lazy(() => import("./orders/[id]"));
const Categories = lazy(() => import("./catalog/categories"));
const Products = lazy(() => import("./catalog/products"));
const ProductEditor = lazy(() => import("./catalog/product-editor"));
const PaperTypes = lazy(() => import("./catalog/paper-types"));
const Finishings = lazy(() => import("./catalog/finishings"));
const CouponsPage = lazy(() => import("./coupons"));
const EstrategiaAdmin = lazy(() => import("./estrategia"));
const Personalizacoes = lazy(() => import("./personalizacoes"));
const Estoque = lazy(() => import("./estoque"));
const CustomersList = lazy(() => import("./customers/index"));
const CustomerDetail = lazy(() => import("./customers/[id]"));
const Reports = lazy(() => import("./reports/index"));
const SettingsPage = lazy(() => import("./settings/index"));
const FakePayment = lazy(() => import("./dev/fake-payment"));
const ShippingSandbox = lazy(() => import("./dev/shipping-sandbox"));

function AdminLoading() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export default function AdminLayout() {
  const { isAuthenticated } = useAdminAuth();
  const [location] = useLocation();

  // Show login page (no shell) when on /admin/login or not authenticated
  if (location === "/login" || !isAuthenticated) {
    return (
      <Suspense fallback={<AdminLoading />}>
        <AdminLogin />
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <AdminHeader />
        <main className="flex-1 overflow-auto">
          <Suspense fallback={<AdminLoading />}>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/orders" component={OrdersList} />
              <Route path="/orders/:id">
                {(params) => <OrderDetail id={params.id} />}
              </Route>
              <Route path="/catalog/categories" component={Categories} />
              <Route path="/catalog/products" component={Products} />
              <Route path="/catalog/products/new">
                <ProductEditor />
              </Route>
              <Route path="/catalog/products/:id/edit">
                {(params) => <ProductEditor id={params.id} />}
              </Route>
              <Route path="/catalog/paper-types" component={PaperTypes} />
              <Route path="/catalog/finishings" component={Finishings} />
              <Route path="/coupons" component={CouponsPage} />
              <Route path="/estrategia" component={EstrategiaAdmin} />
              <Route path="/personalizacoes" component={Personalizacoes} />
              <Route path="/estoque" component={Estoque} />
              <Route path="/customers" component={CustomersList} />
              <Route path="/customers/:id">
                {(params) => <CustomerDetail id={params.id} />}
              </Route>
              <Route path="/reports" component={Reports} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/dev/fake-payment" component={FakePayment} />
              <Route path="/dev/shipping-sandbox" component={ShippingSandbox} />
            </Switch>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
