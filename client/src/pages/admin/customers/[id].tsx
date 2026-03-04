import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getAdminQueryFn } from "@/lib/admin-api";
import OrdersTable from "@/components/admin/orders-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, Calendar } from "lucide-react";
import type { Order, Customer } from "../../../../../shared/schema";

interface CustomerDetail extends Customer {
  orders: Order[];
}

export default function CustomerDetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();

  const { data: customer } = useQuery<CustomerDetail>({
    queryKey: [`/api/admin/customers/${id}`],
    queryFn: getAdminQueryFn(),
  });

  if (!customer) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/customers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{customer.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{customer.email}</span>
            </div>
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{customer.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Cadastrado em {new Date(customer.createdAt).toLocaleDateString("pt-BR")}</span>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Pedidos ({customer.orders.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <OrdersTable orders={customer.orders} showCustomer={false} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
