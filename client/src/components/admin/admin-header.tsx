import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import AdminSidebar from "./admin-sidebar";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  operador: "Operador",
  financeiro: "Financeiro",
};

const roleVariants: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  operador: "secondary",
  financeiro: "outline",
};

export default function AdminHeader() {
  const { user, logout } = useAdminAuth();
  const [, navigate] = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card px-4 sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <AdminSidebar />
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {user && (
          <>
            <span className="text-sm font-medium hidden sm:inline">{user.displayName}</span>
            <Badge variant={roleVariants[user.role] || "outline"}>
              {roleLabels[user.role] || user.role}
            </Badge>
          </>
        )}
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
