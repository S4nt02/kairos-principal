import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { GraficaNavbar } from "@/components/grafica/grafica-navbar";
import { Footer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

type Tab = "login" | "register";

export default function GraficaLogin() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const redirect = new URLSearchParams(search).get("redirect") || "/grafica/conta";
  const { isAuthenticated, login, register } = useAuth();

  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Redirect if already logged in
  if (isAuthenticated) {
    setLocation(redirect);
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      setLocation(redirect);
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (regPassword.length < 6) {
      setError("Senha deve ter pelo menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await register(regName, regEmail, regPhone, regPassword);
      setLocation(redirect);
    } catch (err: any) {
      setError(err.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors";

  return (
    <div className="min-h-screen bg-background font-sans">
      <GraficaNavbar breadcrumbs={[{ label: "Login" }]} />

      <div className="container mx-auto px-6 pt-8 pb-24 flex justify-center">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="w-full max-w-md"
        >
          <Link href="/grafica">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao catálogo
            </div>
          </Link>

          <h1 className="text-3xl font-display font-bold tracking-tight mb-8">Minha Conta</h1>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-border">
            {([
              { key: "login" as Tab, label: "Entrar" },
              { key: "register" as Tab, label: "Criar Conta" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setError(""); }}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px",
                  tab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Login form */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">E-mail</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className={inputClass}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Sua senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-foreground text-background rounded-full text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Entrar
              </button>
            </form>
          )}

          {/* Register form */}
          {tab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Nome completo</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className={inputClass}
                  placeholder="Seu nome completo"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">E-mail</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className={inputClass}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Telefone <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className={inputClass}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-foreground text-background rounded-full text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Criar conta
              </button>
            </form>
          )}
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
