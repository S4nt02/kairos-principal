import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdminQueryFn } from "@/lib/admin-api";
import RevenueChart from "@/components/admin/revenue-chart";
import ReportExportButton from "@/components/admin/report-export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import type { RevenueDataPoint, PaymentStatusBreakdown, TopProduct } from "../../../../../shared/types";

const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#6b7280"];
const PAYMENT_LABELS: Record<string, string> = { approved: "Aprovado", pending: "Pendente", rejected: "Rejeitado" };

const periodOptions = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "12m", days: 365 },
];

export default function Reports() {
  const [days, setDays] = useState(30);

  const { data: revenue } = useQuery<RevenueDataPoint[]>({
    queryKey: [`/api/admin/reports/revenue?days=${days}`],
    queryFn: getAdminQueryFn(),
  });

  const { data: paymentStatus } = useQuery<PaymentStatusBreakdown[]>({
    queryKey: [`/api/admin/reports/payment-status?days=${days}`],
    queryFn: getAdminQueryFn(),
  });

  const { data: topProducts } = useQuery<TopProduct[]>({
    queryKey: [`/api/admin/reports/top-products?days=${days}&limit=10`],
    queryFn: getAdminQueryFn(),
  });

  const { data: monthly } = useQuery<{ period: string; revenue: number; orders: number; avgTicket: number }[]>({
    queryKey: ["/api/admin/reports/monthly-comparison?months=12"],
    queryFn: getAdminQueryFn(),
  });

  const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <div className="flex items-center gap-2">
          <ReportExportButton days={days} />
          <div className="flex gap-1">
            {periodOptions.map((opt) => (
              <Button key={opt.days} variant={days === opt.days ? "default" : "outline"} size="sm" onClick={() => setDays(opt.days)}>
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Faturamento</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="monthly">Comparativo Mensal</TabsTrigger>
        </TabsList>

        {/* Revenue */}
        <TabsContent value="revenue">
          <RevenueChart data={revenue || []} title="Faturamento por Período" />
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Pagamentos por Status</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(paymentStatus || []).map(p => ({ ...p, name: PAYMENT_LABELS[p.status] || p.status }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(v: number, name: string) => [name === "count" ? v : fmt(v), name === "count" ? "Qtd" : "Total"]} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" name="Quantidade" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Distribuição de Valor</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(paymentStatus || []).map(p => ({ name: PAYMENT_LABELS[p.status] || p.status, value: p.total }))}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value"
                        label={({ name, value }) => `${name}: ${fmt(value)}`}
                      >
                        {(paymentStatus || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Top Products */}
        <TabsContent value="products">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Top Produtos por Receita</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => fmt(v)} />
                      <YAxis type="category" dataKey="productName" width={150} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => [fmt(v), "Receita"]} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Detalhamento</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(topProducts || []).map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell className="font-medium">{p.productName}</TableCell>
                        <TableCell className="text-center">{p.quantity}</TableCell>
                        <TableCell className="text-right">{fmt(p.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Monthly Comparison */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader><CardTitle className="text-base">Comparativo Mensal</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-center">Pedidos</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(monthly || []).map((m, i) => {
                    const prev = monthly?.[i - 1];
                    const change = prev ? ((m.revenue - prev.revenue) / (prev.revenue || 1) * 100) : 0;
                    return (
                      <TableRow key={m.period}>
                        <TableCell className="font-medium">{m.period}</TableCell>
                        <TableCell className="text-right">
                          {fmt(m.revenue)}
                          {i > 0 && (
                            <span className={`ml-2 text-xs ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{m.orders}</TableCell>
                        <TableCell className="text-right">{fmt(m.avgTicket)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
