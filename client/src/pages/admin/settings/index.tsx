import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminQueryFn, adminApiRequest } from "@/lib/admin-api";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import ApiStatusCard from "@/components/admin/api-status-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import type { ApiConnectionStatus, AdminUserInfo } from "../../../../../shared/types";
import type { AuditLog } from "../../../../../shared/schema";

const roleLabels: Record<string, string> = { admin: "Admin", operador: "Operador", financeiro: "Financeiro" };

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAdminAuth();

  // ── API Status ──
  const { data: apiStatus } = useQuery<ApiConnectionStatus[]>({
    queryKey: ["/api/admin/settings/api-status"],
    queryFn: getAdminQueryFn(),
  });

  // ── Store Settings ──
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/settings"],
    queryFn: getAdminQueryFn(),
  });

  const [storeSettings, setStoreSettings] = useState({
    warehouse_cep: "",
    store_name: "",
    contact_email: "",
  });

  useEffect(() => {
    if (settings) {
      setStoreSettings({
        warehouse_cep: settings.warehouse_cep || "",
        store_name: settings.store_name || "",
        contact_email: settings.contact_email || "",
      });
    }
  }, [settings]);

  const settingsMutation = useMutation({
    mutationFn: async () => {
      await adminApiRequest("PATCH", "/api/admin/settings", { settings: storeSettings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast.success("Configurações salvas");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Admin Users ──
  const { data: adminUsers } = useQuery<AdminUserInfo[]>({
    queryKey: ["/api/admin/users"],
    queryFn: getAdminQueryFn(),
  });

  const [userDialog, setUserDialog] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ email: "", displayName: "", password: "", role: "operador" as string, active: true });

  const userMutation = useMutation({
    mutationFn: async () => {
      if (editUserId) {
        const data: any = { ...userForm };
        if (!data.password) delete data.password;
        await adminApiRequest("PATCH", `/api/admin/users/${editUserId}`, data);
      } else {
        await adminApiRequest("POST", "/api/admin/users", userForm);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setUserDialog(false);
      setEditUserId(null);
      setUserForm({ email: "", displayName: "", password: "", role: "operador", active: true });
      toast.success(editUserId ? "Admin atualizado" : "Admin criado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => { await adminApiRequest("DELETE", `/api/admin/users/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast.success("Admin removido");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Audit Log ──
  const [auditPage, setAuditPage] = useState(1);
  const { data: auditData } = useQuery<{ data: AuditLog[]; total: number; totalPages: number }>({
    queryKey: [`/api/admin/audit-log?page=${auditPage}&pageSize=20`],
    queryFn: getAdminQueryFn(),
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Tabs defaultValue="api">
        <TabsList>
          <TabsTrigger value="api">Conexões API</TabsTrigger>
          <TabsTrigger value="users">Usuários Admin</TabsTrigger>
          <TabsTrigger value="store">Loja</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* API Status */}
        <TabsContent value="api">
          <ApiStatusCard statuses={apiStatus || []} />
        </TabsContent>

        {/* Admin Users */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Usuários Administrativos</CardTitle>
              <Dialog open={userDialog} onOpenChange={setUserDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => { setEditUserId(null); setUserForm({ email: "", displayName: "", password: "", role: "operador", active: true }); }}>
                    <Plus className="h-4 w-4 mr-2" />Novo Admin
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editUserId ? "Editar" : "Novo"} Admin</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); userMutation.mutate(); }} className="space-y-4">
                    <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Nome</Label><Input value={userForm.displayName} onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Senha {editUserId ? "(deixe vazio para não alterar)" : ""}</Label><Input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required={!editUserId} /></div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={userForm.role} onValueChange={(v) => setUserForm({ ...userForm, role: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="operador">Operador</SelectItem>
                          <SelectItem value="financeiro">Financeiro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2"><Switch checked={userForm.active} onCheckedChange={(v) => setUserForm({ ...userForm, active: v })} /><Label>Ativo</Label></div>
                    <Button type="submit" className="w-full" disabled={userMutation.isPending}>{editUserId ? "Salvar" : "Criar"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead>Último Login</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(adminUsers || []).map((au) => (
                    <TableRow key={au.id}>
                      <TableCell className="font-medium">{au.displayName}</TableCell>
                      <TableCell>{au.email}</TableCell>
                      <TableCell><Badge variant={au.role === "admin" ? "default" : "secondary"}>{roleLabels[au.role]}</Badge></TableCell>
                      <TableCell className="text-center">{au.active ? "Sim" : "Não"}</TableCell>
                      <TableCell>{au.lastLoginAt ? new Date(au.lastLoginAt).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditUserId(au.id);
                            setUserForm({ email: au.email, displayName: au.displayName, password: "", role: au.role, active: au.active });
                            setUserDialog(true);
                          }}><Pencil className="h-4 w-4" /></Button>
                          {au.id !== user?.id && (
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover admin?")) deleteUserMutation.mutate(au.id); }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Store Settings */}
        <TabsContent value="store">
          <Card>
            <CardHeader><CardTitle className="text-base">Configurações da Loja</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); settingsMutation.mutate(); }} className="space-y-4 max-w-md">
                <div className="space-y-2"><Label>Nome da Loja</Label><Input value={storeSettings.store_name} onChange={(e) => setStoreSettings({ ...storeSettings, store_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Email de Contato</Label><Input type="email" value={storeSettings.contact_email} onChange={(e) => setStoreSettings({ ...storeSettings, contact_email: e.target.value })} /></div>
                <div className="space-y-2"><Label>CEP do Depósito</Label><Input value={storeSettings.warehouse_cep} onChange={(e) => setStoreSettings({ ...storeSettings, warehouse_cep: e.target.value })} placeholder="01001000" /></div>
                <Button type="submit" disabled={settingsMutation.isPending}><Save className="h-4 w-4 mr-2" />Salvar</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log */}
        <TabsContent value="audit">
          <Card>
            <CardHeader><CardTitle className="text-base">Log de Auditoria</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(auditData?.data || []).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{new Date(log.createdAt).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">{log.adminUserId.slice(0, 8)}</TableCell>
                      <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                      <TableCell>{log.entityType}</TableCell>
                      <TableCell className="font-mono text-xs">{log.entityId?.slice(0, 8) || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {auditData && auditData.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={auditPage <= 1} onClick={() => setAuditPage(auditPage - 1)}>Anterior</Button>
              <span className="text-sm py-2">Página {auditPage} de {auditData.totalPages}</span>
              <Button variant="outline" size="sm" disabled={auditPage >= auditData.totalPages} onClick={() => setAuditPage(auditPage + 1)}>Próxima</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
