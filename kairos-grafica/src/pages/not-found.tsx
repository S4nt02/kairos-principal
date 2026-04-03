import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Página não encontrada</p>
      <Link href="/grafica" className="text-primary underline">
        Voltar ao catálogo
      </Link>
    </div>
  );
}
