import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import type { ApiConnectionStatus } from "../../../../shared/types";

interface ApiStatusCardProps {
  statuses: ApiConnectionStatus[];
}

export default function ApiStatusCard({ statuses }: ApiStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conexões de API</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {statuses.map((s) => (
          <div key={s.service} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {s.connected
                ? <CheckCircle className="h-4 w-4 text-green-600" />
                : <XCircle className="h-4 w-4 text-red-500" />}
              <span className="text-sm font-medium">{s.service}</span>
            </div>
            <Badge variant={s.connected ? "default" : "destructive"}>
              {s.details || (s.connected ? "Conectado" : "Desconectado")}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
