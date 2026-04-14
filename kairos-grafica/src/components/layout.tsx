import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { Copy, Check, Menu, X } from "lucide-react";

interface PillState {
  left: number;
  width: number;
  visible: boolean;
}

const NAV_LINKS: Array<{ label: string; id?: string; href?: string }> = [
  { label: "Sobre", id: "sobre" },
  { label: "Serviços", id: "servicos" },
  { label: "Manifesto", id: "manifesto" },
  { label: "Gráfica", href: "/grafica" },
  { label: "Estratégia", href: "/estrategia" },
];

export function Navbar() {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pill, setPill] = useState<PillState>({ left: 0, width: 0, visible: false });

  const navInnerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | HTMLDivElement | null>>({});

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close drawer on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const copyEmail = () => {
    navigator.clipboard.writeText("CONTATO@KAIROS.COM");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 300);
  };

  const movePillTo = useCallback((key: string) => {
    const container = navInnerRef.current;
    const btn = btnRefs.current[key];
    if (!container || !btn) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setPill({
      left: bRect.left - cRect.left,
      width: bRect.width,
      visible: true,
    });
  }, []);

  const hidePill = useCallback(() => {
    setPill((p) => ({ ...p, visible: false }));
    setActiveTab(null);
  }, []);

  const handleEnter = (key: string) => {
    setActiveTab(key);
    movePillTo(key);
  };

  const Logo = () => (
    <motion.img
      src="/logos/logo-tipografia-branco.png"
      alt="Kairós"
      className="h-6 w-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    />
  );

  return (
    <>
      {/* ── DESKTOP NAV (md+) ── */}
      <nav className="fixed top-6 left-0 right-0 z-50 hidden md:flex justify-center px-4">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          ref={navInnerRef}
          onMouseLeave={hidePill}
          className={`relative flex items-center gap-1 p-1.5 backdrop-blur-xl border rounded-full transition-all duration-500 ${
            scrolled
              ? "bg-black/30 border-white/10 shadow-2xl"
              : "bg-black/20 border-white/[0.06]"
          }`}
        >
          {/* Morphing pill background */}
          <div
            aria-hidden
            className="absolute top-1.5 bottom-1.5 rounded-full bg-white/15 pointer-events-none"
            style={{
              left: pill.left,
              width: pill.width,
              opacity: pill.visible ? 1 : 0,
              transition:
                "left 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94), width 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s ease",
            }}
          />

          {/* Logo */}
          <Link href="/">
            <div
              ref={(el) => { btnRefs.current["logo"] = el; }}
              onMouseEnter={() => handleEnter("logo")}
              className="px-5 py-2.5 flex items-center cursor-pointer relative z-10"
            >
              <Logo />
            </div>
          </Link>

          <div className="w-px h-5 bg-white/10 relative z-10" />

          {/* Sobre */}
          <div className="relative" onMouseEnter={() => handleEnter("about")}>
            <button
              ref={(el) => { btnRefs.current["about"] = el; }}
              onClick={() => scrollTo("sobre")}
              className="px-5 py-2.5 text-sm font-medium text-white/80 hover:text-white transition-colors rounded-full relative z-10"
            >
              Sobre
            </button>
            <AnimatePresence>
              {activeTab === "about" && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 mt-4 w-[320px] p-6 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] text-white shadow-2xl"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 block mb-4">Missão</span>
                  <p className="text-sm leading-relaxed font-medium mb-3">
                    Dar forma ao que o céu comunica, transformando fé em expressão cultural por meio de marcas, livros, artistas e projetos audiovisuais.
                  </p>
                  <p className="text-xs leading-relaxed opacity-50">
                    Uma casa criativa da Indústria Criativa cristã dedicada a transformar propósito em expressão cultural.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Serviços */}
          <button
            ref={(el) => { btnRefs.current["servicos"] = el; }}
            onMouseEnter={() => handleEnter("servicos")}
            onClick={() => scrollTo("servicos")}
            className="px-5 py-2.5 text-sm font-medium text-white/80 hover:text-white transition-colors rounded-full relative z-10"
          >
            Serviços
          </button>

          {/* Manifesto */}
          <button
            ref={(el) => { btnRefs.current["manifesto"] = el; }}
            onMouseEnter={() => handleEnter("manifesto")}
            onClick={() => scrollTo("manifesto")}
            className="px-5 py-2.5 text-sm font-medium text-white/80 hover:text-white transition-colors rounded-full relative z-10"
          >
            Manifesto
          </button>

          {/* Gráfica */}
          <Link href="/grafica">
            <div
              ref={(el) => { btnRefs.current["grafica"] = el; }}
              onMouseEnter={() => handleEnter("grafica")}
              className="px-5 py-2.5 text-sm font-medium text-white/80 hover:text-white transition-colors rounded-full relative z-10 cursor-pointer"
            >
              Gráfica
            </div>
          </Link>

          {/* Estratégia */}
          <Link href="/estrategia">
            <div
              ref={(el) => { btnRefs.current["estrategia"] = el; }}
              onMouseEnter={() => handleEnter("estrategia")}
              className="px-5 py-2.5 text-sm font-medium text-white/80 hover:text-white transition-colors rounded-full relative z-10 cursor-pointer"
            >
              Estratégia
            </div>
          </Link>

          {/* Contato */}
          <div className="relative" onMouseEnter={() => handleEnter("contact")}>
            <button
              ref={(el) => { btnRefs.current["contact"] = el; }}
              className="px-5 py-2.5 text-sm font-medium text-white/80 hover:text-white transition-colors rounded-full relative z-10"
            >
              Contato
            </button>
            <AnimatePresence>
              {activeTab === "contact" && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full right-0 mt-4 w-[300px] p-6 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] text-white shadow-2xl"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 block mb-2">Fale conosco</span>
                  <p className="text-sm font-medium mb-4 opacity-80">
                    Vamos dar forma ao que o céu está comunicando a você.
                  </p>
                  <div className="flex items-center justify-between p-1 bg-white/10 rounded-full pl-4">
                    <span className="text-[10px] font-bold tracking-widest opacity-80">CONTATO@KAIROS.COM</span>
                    <button
                      onClick={copyEmail}
                      className="flex items-center justify-center w-9 h-9 bg-white/20 hover:bg-white/30 transition-colors rounded-full"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </nav>

      {/* ── MOBILE NAV (< md) ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 md:hidden">
        {/* Top bar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={`flex items-center justify-between px-5 py-4 backdrop-blur-xl border-b transition-all duration-500 ${
            scrolled || mobileOpen
              ? "bg-black/50 border-white/10"
              : "bg-black/20 border-white/[0.06]"
          }`}
        >
          <Link href="/">
            <div className="flex items-center cursor-pointer">
              <Logo />
            </div>
          </Link>

          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileOpen ? (
                <motion.span
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <X className="w-5 h-5" />
                </motion.span>
              ) : (
                <motion.span
                  key="open"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Menu className="w-5 h-5" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </motion.div>

        {/* Drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-black/80 backdrop-blur-2xl border-b border-white/10 px-5 pb-8 pt-4"
            >
              {/* Nav links */}
              <ul className="mb-8">
                {NAV_LINKS.map((link, i) => (
                  <motion.li
                    key={link.id || link.href}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    {link.href ? (
                      <Link href={link.href} onClick={() => setMobileOpen(false)}>
                        <div className="w-full text-left py-5 text-2xl font-display font-bold uppercase tracking-wide text-white/80 hover:text-white border-b border-white/[0.07] transition-colors active:text-primary">
                          {link.label}
                        </div>
                      </Link>
                    ) : (
                      <button
                        onClick={() => scrollTo(link.id!)}
                        className="w-full text-left py-5 text-2xl font-display font-bold uppercase tracking-wide text-white/80 hover:text-white border-b border-white/[0.07] transition-colors active:text-primary"
                      >
                        {link.label}
                      </button>
                    )}
                  </motion.li>
                ))}
              </ul>

              {/* Contact block */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30 block mb-3">
                  Fale conosco
                </span>
                <div className="flex items-center justify-between p-1 bg-white/10 rounded-full pl-4">
                  <span className="text-xs font-bold tracking-widest text-white/70">
                    CONTATO@KAIROS.COM
                  </span>
                  <button
                    onClick={copyEmail}
                    className="flex items-center justify-center w-10 h-10 bg-white/20 active:bg-white/30 transition-colors rounded-full"
                  >
                    {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}

const FOOTER_EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];
const navLinks = ["Sobre", "Serviços", "Manifesto", "Gráfica", "Estratégia", "Valores"];
const navHrefs = ["#sobre", "#servicos", "#manifesto", "/grafica", "/estrategia", "#valores"];

export function Footer() {
  return (
    <footer className="bg-foreground text-white py-20">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand block */}
          <div className="space-y-6 md:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: FOOTER_EASE }}
            >
              <img src="/logos/logo-tipografia-branco.png" alt="Kairós" className="h-10 w-auto" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1, ease: FOOTER_EASE }}
              className="text-white/50 text-sm max-w-md leading-relaxed"
            >
              Uma casa criativa da Indústria Criativa cristã, dedicada a
              transformar propósito em expressão cultural. Dar forma ao que o céu
              comunica.
            </motion.p>
          </div>

          {/* Nav links — staggered */}
          <div>
            <motion.h4
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: FOOTER_EASE }}
              className="font-bold mb-6 text-sm uppercase tracking-widest text-white/40"
            >
              Navegação
            </motion.h4>
            <ul className="space-y-4 text-sm text-white/60">
              {navLinks.map((label, i) => (
                <motion.li
                  key={label}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.07, ease: FOOTER_EASE }}
                >
                  {navHrefs[i].startsWith("/") ? (
                    <Link href={navHrefs[i]} className="hover:text-white transition-colors">
                      {label}
                    </Link>
                  ) : (
                    <a href={navHrefs[i]} className="hover:text-white transition-colors">
                      {label}
                    </a>
                  )}
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <motion.h4
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1, ease: FOOTER_EASE }}
              className="font-bold mb-6 text-sm uppercase tracking-widest text-white/40"
            >
              Conecte-se
            </motion.h4>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: FOOTER_EASE }}
              className="flex gap-4 mb-6"
            >
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
              >
                <span className="sr-only">Instagram</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeWidth="2" />
                  <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" strokeWidth="2" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2" />
                </svg>
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
              >
                <span className="sr-only">YouTube</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3, ease: FOOTER_EASE }}
              className="text-xs text-white/30 font-mono"
            >
              CONTATO@KAIROS.COM
            </motion.p>
          </div>
        </div>

        {/* Bottom bar — scaleX line + fade copyright */}
        <div className="pt-8">
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.0, ease: FOOTER_EASE }}
            style={{ originX: 0 }}
            className="h-px bg-white/10 mb-8"
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3, ease: FOOTER_EASE }}
            className="flex flex-col md:flex-row justify-between items-center text-xs text-white/30"
          >
            <p>© 2026 Kairós — Casa Criativa. Todos os direitos reservados.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <Link href="/grafica/privacidade" className="hover:text-white transition-colors">
                Política de Privacidade
              </Link>
              <Link href="/grafica/termos" className="hover:text-white transition-colors">
                Termos de Uso
              </Link>
              <Link href="/grafica/faq" className="hover:text-white transition-colors">
                FAQ
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </footer>
  );
}
