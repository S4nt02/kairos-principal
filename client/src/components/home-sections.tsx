import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

export function Hero() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollToContent = () => {
    document.getElementById("sobre")?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    const content = contentRef.current;
    if (!wrapper || !inner || !content) return;

    // Disable pin + scrub on mobile — iOS Safari conflicts with touch scroll
    if (window.innerWidth < 768) return;

    // Pin wrapper (beige bg shows through as inner shrinks)
    const pinTl = gsap.timeline({
      scrollTrigger: {
        trigger: wrapper,
        start: "top top",
        end: "+=800",
        scrub: 1.2,
        pin: true,
        pinSpacing: false,
        anticipatePin: 1,
      },
    });

    // Animate inset inward + border-radius: reveals beige background on all sides
    // AND fade out ALL content together (overline, title, tagline, CTA)
    pinTl
      .to(inner, {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
        borderRadius: "32px",
        ease: "none",
      })
      .to(
        content,
        {
          y: -120,
          opacity: 0,
          ease: "none",
        },
        "<"
      );

    return () => {
      pinTl.kill();
      ScrollTrigger.getAll().forEach((st) => {
        if (st.vars.trigger === wrapper) st.kill();
      });
    };
  }, []);

  return (
    // Outer wrapper — bg-background (beige) shows through as inner shrinks
    <div ref={wrapperRef} className="relative h-screen w-full bg-background md:h-screen" style={{ minHeight: "100svh" }}>
      {/* Inner — absolute inset:0, GSAP animates inset outward to reveal beige */}
      <div
        ref={innerRef}
        className="absolute overflow-hidden will-change-transform"
        style={{ top: 0, right: 0, bottom: 0, left: 0, borderRadius: 0 }}
      >
        {/* Video background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/videoplayback.webm" type="video/webm" />
        </video>

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/40 z-[1]" />

        {/* Dot grid texture */}
        <div className="absolute inset-0 opacity-[0.04] z-[2]">
          <div
            className="w-full h-full"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-[120px] z-[3]" />

        {/* Dissolve gradient at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/60 to-transparent z-[4] pointer-events-none" />

        {/* Content — GSAP animates this entire div */}
        <div
          ref={contentRef}
          className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 will-change-transform pt-16 md:pt-0"
        >
          <div className="max-w-[1000px]">
            {/* Overline */}
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
              className="text-[hsl(38,60%,75%)] font-mono text-[10px] md:text-xs uppercase tracking-[0.4em] mb-8 block"
            >
              Casa Criativa — Cultura do Reino
            </motion.span>

            {/* Main title */}
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.5, ease: EASE }}
              className="text-5xl md:text-[130px] lg:text-[160px] font-display font-bold italic text-[hsl(40,25%,88%)] leading-[0.85] tracking-[-0.03em] mb-8 md:mb-10"
            >
              Kairós
            </motion.h1>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9, ease: EASE }}
              className="text-[hsl(40,20%,75%)] text-base md:text-xl font-light leading-relaxed max-w-lg mx-auto mb-14"
            >
              Dar forma ao que o céu comunica.
              <br />
              <span className="text-[hsl(40,15%,65%)]">
                Transformando fé em expressão cultural.
              </span>
            </motion.p>

            {/* CTA */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2, ease: EASE }}
              onClick={scrollToContent}
              className="group flex flex-col items-center gap-4 mx-auto"
            >
              <span className="px-8 py-3.5 bg-white/[0.07] backdrop-blur-md border border-white/10 rounded-full text-white text-sm font-medium tracking-wide hover:bg-white/[0.12] hover:border-white/20 transition-all duration-500">
                Conheça a Embaixada
              </span>
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowDown className="w-4 h-4 text-white/30" />
              </motion.div>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PurposeBlock() {
  return (
    <section className="py-32 bg-background">
      <div className="container mx-auto px-6 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Label wipe from left */}
          <div className="overflow-hidden mb-6">
            <motion.span
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-primary font-mono text-xs uppercase tracking-[0.3em] block"
            >
              Propósito
            </motion.span>
          </div>

          {/* Title — two lines with stagger */}
          <div className="mb-2">
            <motion.h2
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
              className="text-3xl md:text-5xl font-display font-medium leading-tight"
            >
              Tudo é sinal.
            </motion.h2>
          </div>
          <div className="mb-10">
            <motion.h2
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.9, delay: 0.22, ease: EASE }}
              className="text-3xl md:text-5xl font-display font-medium leading-tight italic text-muted-foreground"
            >
              Tudo é convocação.
            </motion.h2>
          </div>

          {/* Quote block — curtain reveal from bottom */}
          <motion.div
            initial={{ clipPath: "inset(100% 0 0 0)", opacity: 1 }}
            whileInView={{ clipPath: "inset(0% 0 0 0)" }}
            viewport={{ once: true }}
            transition={{ duration: 1.0, delay: 0.35, ease: EASE }}
            className="relative rounded-3xl bg-foreground text-white overflow-hidden"
          >
            <div className="absolute inset-0 opacity-[0.03]">
              <div
                className="w-full h-full"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                  backgroundSize: "32px 32px",
                }}
              />
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.75, ease: EASE }}
              className="relative p-10 md:p-16 text-lg md:text-xl leading-relaxed text-white/80 font-display italic"
            >
              "Manifestar a Cultura do Reino na Terra através da criatividade,
              fazendo com que cada obra visual, escrita, sonora ou material não
              apenas exista, mas ecoe."
            </motion.p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
