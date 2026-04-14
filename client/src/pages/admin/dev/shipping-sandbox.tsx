import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminApiRequest, getAdminQueryFn } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, RefreshCw, AlertCircle, CheckCircle2, XCircle, ExternalLink, Copy, KeyRound, LogIn } from "lucide-react";
import { toast } from "sonner";

interface ShippingStatus {
  mode: "sandbox" | "production" | "mock";
  hasToken: boolean;
  baseUrl: string;
  sandboxToken: string | null;
  devSessionToken: string | null;
}

interface ShippingQuote {
  carrier: string;
  service: string;
  price: number;
  deliveryDays: number;
  melhorEnvioId?: number;
}

export default function ShippingSandbox() {
  const [cepDestino, setCepDestino] = useState("");
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [authCode, setAuthCode] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [redirectUri, setRedirectUri] = useState("https://kairos.com.br/api/oauth/callback");
  const [oauthToken, setOauthToken] = useState<{ access_token: string; refresh_token: string } | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  const { data: status, refetch: refetchStatus, isLoading } = useQuery<ShippingStatus>({
    queryKey: ["/api/dev/shipping/status"],
    queryFn: getAdminQueryFn(),
  });

  // Step 1: Get authorization URL
  const getUrlMutation = useMutation({
    mutationFn: async () => {
      const res = await adminApiRequest("GET", `/api/dev/shipping/oauth/url?clientId=${encodeURIComponent(clientId)}&redirectUri=${encodeURIComponent(redirectUri)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data as { url: string; callbackUrl: string };
    },
    onSuccess: (data) => {
      setAuthUrl(data.url);
      setCallbackUrl(data.callbackUrl);
      window.open(data.url, "_blank");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Step 2: Exchange code for token
  const exchangeMutation = useMutation({
    mutationFn: async () => {
      setExchangeError(null);
      const res = await adminApiRequest("POST", "/api/dev/shipping/oauth/exchange", {
        code: authCode.trim(),
        clientId: clientId.trim() || undefined,
        clientSecret: clientSecret.trim() || undefined,
        redirectUri: redirectUri.trim() || undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setOauthToken({ access_token: data.access_token, refresh_token: data.refresh_token });
      refetchStatus();
      toast.success("Token obtido! Copie e adicione ao .env para persistir.");
    },
    onError: (e: Error) => {
      setExchangeError(e.message);
      toast.error(e.message);
    },
  });

  // Password grant (simpler)
  const passwordMutation = useMutation({
    mutationFn: async () => {
      setExchangeError(null);
      const res = await adminApiRequest("POST", "/api/dev/shipping/oauth/password", {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        email: email.trim(),
        password,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setOauthToken({ access_token: data.access_token, refresh_token: data.refresh_token });
      refetchStatus();
      toast.success("Token obtido via login direto!");
    },
    onError: (e: Error) => { setExchangeError(e.message); toast.error(e.message); },
  });

  // Refresh token
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await adminApiRequest("POST", "/api/dev/shipping/oauth/refresh", {});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setOauthToken((prev) => prev ? { ...prev, access_token: data.access_token } : null);
      refetchStatus();
      toast.success("Token renovado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Calculate shipping
  const calcMutation = useMutation({
    mutationFn: async () => {
      const res = await adminApiRequest("POST", "/api/dev/shipping/calculate", { cepDestino });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setQuotes(data.quotes || []);
      toast.success(`${data.quotes?.length ?? 0} cotação(ões) retornada(s)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const hasSession = status?.devSessionToken || oauthToken;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Truck className="w-6 h-6 text-blue-500" />
          Melhor Envio — Sandbox
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Conecte com a API sandbox via OAuth2 para testar cotações e etiquetas sem custo real.
        </p>
      </div>

      {/* Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            Status da Conexão
            <Button variant="ghost" size="sm" onClick={() => refetchStatus()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={hasSession ? "bg-blue-500 text-white" : "bg-orange-500 text-white"}>
              {hasSession ? "Sandbox" : "Mock (sem token)"}
            </Badge>
            {hasSession ? (
              <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" /> Token ativo em memória
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-orange-500">
                <XCircle className="w-4 h-4" /> Sem token — use o fluxo OAuth abaixo
              </span>
            )}
            {status?.devSessionToken && (
              <code className="text-xs bg-muted px-2 py-0.5 rounded">{status.devSessionToken}</code>
            )}
          </div>
        </CardContent>
      </Card>

      {/* OAuth2 Flow */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Obter Token Sandbox
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Tabs defaultValue="password">
            <TabsList className="w-full">
              <TabsTrigger value="password" className="flex-1">
                <LogIn className="w-3.5 h-3.5 mr-1.5" /> Login Direto (recomendado)
              </TabsTrigger>
              <TabsTrigger value="oauth" className="flex-1">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Authorization Code
              </TabsTrigger>
            </TabsList>

            {/* PASSWORD GRANT */}
            <TabsContent value="password" className="space-y-4 pt-3">
              <p className="text-xs text-muted-foreground">
                Use o email e senha da sua conta em <strong>sandbox.melhorenvio.com.br</strong>. Mais simples que o fluxo OAuth com redirect.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Client ID</Label>
                  <Input placeholder="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} className="font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Client Secret</Label>
                  <Input type="password" placeholder="Client Secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email (conta sandbox)</Label>
                  <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Senha (conta sandbox)</Label>
                  <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              {exchangeError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{exchangeError}</span>
                </div>
              )}
              <Button
                className="w-full"
                onClick={() => passwordMutation.mutate()}
                disabled={passwordMutation.isPending || !clientId || !clientSecret || !email || !password}
              >
                {passwordMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                Entrar e Obter Token
              </Button>
            </TabsContent>

            {/* AUTHORIZATION CODE */}
            <TabsContent value="oauth" className="space-y-5 pt-3">

          {/* Credenciais inline */}
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Credenciais do aplicativo{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (encontradas em sandbox.melhorenvio.com.br → Tokens de acesso → seu app)
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Client ID</Label>
                <Input
                  placeholder="Client ID do app"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client Secret</Label>
                <Input
                  type="password"
                  placeholder="Client Secret do app"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Redirect URI{" "}
                <span className="text-muted-foreground">(deve ser idêntica à cadastrada no app)</span>
              </Label>
              <Input
                placeholder="https://..."
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Step 1 */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Passo 1 — Abrir página de autorização</p>
            {!clientId.trim() && (
              <p className="text-xs text-orange-500 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Preencha o Client ID acima antes de autorizar.
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => getUrlMutation.mutate()}
              disabled={getUrlMutation.isPending || !clientId.trim()}
            >
              {getUrlMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
              Autorizar no Melhor Envio Sandbox
            </Button>
            {callbackUrl && (
              <p className="text-xs text-muted-foreground">
                Após autorizar, o ME vai redirecionar para <code className="bg-muted px-1 rounded">{callbackUrl}?code=XXXX</code>.
                Copie o valor do parâmetro <code className="bg-muted px-1 rounded">code</code> da URL (mesmo que a página dê erro 404).
              </p>
            )}
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Passo 2 — Colar o código de autorização</p>
            <p className="text-xs text-muted-foreground">
              O <code className="bg-muted px-1 rounded">code</code> expira em ~1 minuto. Gere um novo clicando em Autorizar acima.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Cole o code da URL aqui..."
                value={authCode}
                onChange={(e) => { setAuthCode(e.target.value); setExchangeError(null); }}
                className="font-mono text-xs"
              />
              <Button
                onClick={() => exchangeMutation.mutate()}
                disabled={exchangeMutation.isPending || !authCode.trim() || !clientId.trim() || !clientSecret.trim()}
              >
                {exchangeMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Trocar por Token"}
              </Button>
            </div>
            {exchangeError && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Erro na troca</p>
                  <p className="text-xs mt-0.5">{exchangeError}</p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    Verifique: (1) o code pode ter expirado — gere um novo; (2) o Redirect URI deve ser idêntico ao cadastrado no app; (3) Client ID e Secret corretos.
                  </p>
                </div>
              </div>
            )}
          </div>
          </TabsContent>
          </Tabs>

          {/* Token result — shown after either method succeeds */}
          {oauthToken && (
            <div className="space-y-3 pt-3 border-t">
              <p className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Token obtido com sucesso!
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Access Token (validade: 30 dias)</Label>
                <div className="flex gap-2">
                  <Input value={oauthToken.access_token} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy(oauthToken.access_token)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Refresh Token</Label>
                <div className="flex gap-2">
                  <Input value={oauthToken.refresh_token} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy(oauthToken.refresh_token)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="bg-muted rounded p-3 text-xs font-mono">
                <p className="text-muted-foreground"># Adicione ao .env para persistir:</p>
                <p>MELHOR_ENVIO_SANDBOX_TOKEN={oauthToken.access_token}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                Renovar Token
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calculate */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Testar Cotação de Frete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasSession && (
            <div className="flex items-center gap-2 text-sm text-orange-500">
              <AlertCircle className="w-4 h-4" />
              Sem token ativo — cotações retornarão dados mock.
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>CEP Destino</Label>
              <Input
                placeholder="00000-000"
                value={cepDestino}
                onChange={(e) => setCepDestino(e.target.value)}
                maxLength={9}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => calcMutation.mutate()}
                disabled={calcMutation.isPending || cepDestino.replace(/\D/g, "").length < 8}
              >
                {calcMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Truck className="w-4 h-4 mr-2" />}
                Calcular
              </Button>
            </div>
          </div>

          {quotes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Cotações {hasSession ? "(API Sandbox Real)" : "(Mock)"}
              </p>
              {quotes.map((q, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm">
                  <div>
                    <span className="font-medium">{q.carrier}</span>
                    <span className="text-muted-foreground ml-1">— {q.service}</span>
                    {q.melhorEnvioId && (
                      <span className="ml-2 text-xs text-muted-foreground font-mono">id:{q.melhorEnvioId}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">R$ {q.price.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{q.deliveryDays} dia(s)</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
