import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdminQueryFn } from "@/lib/admin-api";
import KPICard from "@/components/admin/kpi-card";
import RevenueChart from "@/components/admin/revenue-chart";
import OrdersTable from "@/components/admin/orders-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, ShoppingCart, Users, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { DashboardKPIs, RevenueDataPoint, OrderStatusCount, TopProduct } from "../../../../shared/types";
import type { Order } from "../../../../shared/schema";

const periodOptions = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "12m", days: 365 },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  production: "#8b5cf6",
  shipped: "#06b6d4",
  delivered: "#10b981",
  cancelled: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  production: "Produção",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export default function Dashboard() {
  const [days, setDays] = useState(30);

  const { data: kpis } = useQuery<DashboardKPIs>({
    queryKey: [`/api/admin/dashboard/kpis?days=${days}`],
    queryFn: getAdminQueryFn(),
  });

  const { data: revenue } = useQuery<RevenueDataPoint[]>({
    queryKey: [`/api/admin/dashboard/revenue-chart?days=${days}`],
    queryFn: getAdminQueryFn(),
  });

  const { data: statusDist } = useQuery<OrderStatusCount[]>({
    queryKey: ["/api/admin/dashboard/order-status-distribution"],
    queryFn: getAdminQueryFn(),
  });

  const { data: topProducts } = useQuery<TopProduct[]>({
    queryKey: [`/api/admin/dashboard/top-products?days=${days}`],
    queryFn: getAdminQueryFn(),
  });

  const { data: recentOrders } = useQuery<Order[]>({
    queryKey: ["/api/admin/dashboard/recent-orders"],
    queryFn: getAdminQueryFn(),
  });

  const fmt = (n: number) =>
    `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-1">
          {periodOptions.map((opt) => (
            <Button
              key={opt.days}
              variant={days === opt.days ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(opt.days)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Faturamento"
          value={kpis ? fmt(kpis.revenue) : "R$ 0,00"}
          change={kpis?.revenueChange || 0}
          icon={DollarSign}
        />
        <KPICard
          title="Pedidos"
          value={String(kpis?.orders || 0)}
          change={kpis?.ordersChange || 0}
          icon={ShoppingCart}
        />
        <KPICard
          title="Novos Clientes"
          value={String(kpis?.newCustomers || 0)}
          change={kpis?.newCustomersChange || 0}
          icon={Users}
        />
        <KPICard
          title="Ticket Médio"
          value={kpis ? fmt(kpis.avgTicket) : "R$ 0,00"}
          change={kpis?.avgTicketChange || 0}
          icon={TrendingUp}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2">
          <RevenueChart data={revenue || []} />
        </div>

        {/* Status Distribution Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(statusDist || []).map((s) => ({ name: STATUS_LABELS[s.status] || s.status, value: s.count }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {(statusDist || []).map((s, i) => (
                      <Cell key={i} fill={STATUS_COLORS[s.status] || "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis
                    type="category"
                    dataKey="productName"
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip formatter={(value: number) => [fmt(value), "Receita"]} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos Pedidos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <OrdersTable orders={recentOrders || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
