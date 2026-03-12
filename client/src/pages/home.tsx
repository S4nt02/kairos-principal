import { useRef, useEffect } from "react";
import { Navbar, Footer } from "@/components/layout";
import { Hero, PurposeBlock } from "@/components/home-sections";
import { ManifestoSection } from "@/components/manifesto-section";
import { ServicesSection } from "@/components/services-section";
import { ValuesSection } from "@/components/values-section";
import { motion } from "framer-motion";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

export default function Home() {
  const sobreHeadingRef = useRef<HTMLHeadingElement>(null);
  const sobreSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const heading = sobreHeadingRef.current;
    const section = sobreSectionRef.current;
    if (!heading || !section) return;

    // Parallax: heading moves up at 60% scroll speed
    const st1 = gsap.to(heading, {
      y: -60,
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        scrub: 0.6,
      },
    });

    return () => {
      st1.kill();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      <main>
        <Hero />

        {/* Intro / Sobre — Swiss Style with GSAP parallax */}
        <section ref={sobreSectionRef} id="sobre" className="section-swiss bg-background parallax-container">
          <div className="container mx-auto px-6 md:px-12">
            <div className="max-w-5xl">
              {/* Label slides in from left */}
              <div className="overflow-hidden mb-10">
                <motion.span
                  initial={{ x: -20, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="text-white font-mono text-xs uppercase tracking-[0.3em] block"
                  style={{ mixBlendMode: "difference" }}
                >
                  Sobre a Kairós
                </motion.span>
              </div>

              {/* Swiss Style giant heading — GSAP parallax */}
              <div className="mb-6">
                <motion.h3
                  ref={sobreHeadingRef}
                  initial={{ y: 40, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.1, delay: 0.1, ease: EASE }}
                  className="swiss-title gsap-parallax font-display font-bold text-white"
                  style={{ mixBlendMode: "difference" }}
                >
                  Uma casa criativa
                  <br />
                  <span className="text-white/70">dedicada ao Reino.</span>
                </motion.h3>
              </div>
            </div>
          </div>
        </section>

        {/* Missão / Visão — asymmetric entry */}
        <section className="py-28 bg-muted/30">
          <div className="container mx-auto px-6 md:px-12">
            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-32">
              {/* Missão — enters from left */}
              <motion.div
                initial={{ x: -30, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: EASE }}
              >
                <div className="overflow-hidden mb-6">
                  <motion.span
                    initial={{ y: 16, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.15, ease: EASE }}
                    className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary block"
                  >
                    Missão
                  </motion.span>
                </div>
                <p className="text-xl md:text-2xl font-sans leading-relaxed">
                  Dar forma ao que o céu comunica, transformando fé em expressão
                  cultural por meio de marcas, livros, artistas, produtos,
                  roupas e projetos audiovisuais que ecoam a Cultura do Reino.
                </p>
              </motion.div>

              {/* Vertical divider — grows top to bottom */}
              <motion.div
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
                style={{ originY: 0 }}
                className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-border"
              />

              {/* Visão — enters from right */}
              <motion.div
                initial={{ x: 30, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
              >
                <div className="overflow-hidden mb-6">
                  <motion.span
                    initial={{ y: 16, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
                    className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary block"
                  >
                    Visão
                  </motion.span>
                </div>
                <p className="text-xl md:text-2xl font-sans leading-relaxed">
                  Ser a principal referência criativa do mercado cristão,
                  influenciando a cultura através de beleza, excelência e
                  propósito; consolidando artistas, autores e empreendedores que
                  desejam manifestar o Reino através da arte.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        <PurposeBlock />

        <ServicesSection />

        <ManifestoSection />

        <ValuesSection />
      </main>

      <Footer />
    </div>
  );
}
