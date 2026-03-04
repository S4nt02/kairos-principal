import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { getAdminToken } from "@/hooks/use-admin-auth";

interface ReportExportButtonProps {
  days: number;
}

export default function ReportExportButton({ days }: ReportExportButtonProps) {
  const handleExport = async () => {
    const token = getAdminToken();
    const res = await fetch(`/api/admin/reports/export/csv?days=${days}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4 mr-2" />Exportar CSV
    </Button>
  );
}
