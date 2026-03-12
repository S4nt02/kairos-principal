import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

declare global {
  interface Window {
    UnicornStudio?: {
      addScene: (config: {
        elementId: string;
        filePath?: string;
        fps?: number;
        scale?: number;
        dpi?: number;
        lazyLoad?: boolean;
        production?: boolean;
      }) => Promise<{ destroy: () => void; resize: () => void; paused: boolean }>;
    };
  }
}

export function Hero() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;

    // Disable pin + scrub on mobile — iOS Safari conflicts with touch scroll
    if (window.innerWidth < 768) return;

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

    pinTl.to(inner, {
      top: "20px",
      right: "20px",
      bottom: "20px",
      left: "20px",
      borderRadius: "32px",
      ease: "none",
    });

    return () => {
      pinTl.kill();
      ScrollTrigger.getAll().forEach((st) => {
        if (st.vars.trigger === wrapper) st.kill();
      });
    };
  }, []);

  // Initialize Unicorn Studio scene
  useEffect(() => {
    let destroyed = false;

    const initScene = () => {
      if (destroyed || !window.UnicornStudio) return;
      window.UnicornStudio.addScene({
        elementId: "unicorn-hero",
        filePath: "/unicorn-scene.json",
        fps: 60,
        scale: 1,
        dpi: 1.5,
        production: true,
      })
        .then((scene) => {
          if (destroyed) {
            scene.destroy();
          } else {
            sceneRef.current = scene;
          }
        })
        .catch((err) => console.error("Unicorn Studio error:", err));
    };

    // Wait for the script to load
    if (window.UnicornStudio) {
      initScene();
    } else {
      const check = setInterval(() => {
        if (window.UnicornStudio) {
          clearInterval(check);
          initScene();
        }
      }, 100);
      // Stop checking after 10s
      setTimeout(() => clearInterval(check), 10000);
    }

    return () => {
      destroyed = true;
      if (sceneRef.current) {
        sceneRef.current.destroy();
        sceneRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative h-screen w-full bg-background md:h-screen" style={{ minHeight: "100svh" }}>
      <div
        ref={innerRef}
        className="absolute overflow-hidden will-change-transform"
        style={{ top: 0, right: 0, bottom: 0, left: 0, borderRadius: 0 }}
      >
        {/* Unicorn Studio WebGL scene */}
        <div id="unicorn-hero" className="absolute inset-0 w-full h-full" />
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
              className="text-3xl md:text-5xl font-display font-medium leading-tight text-muted-foreground"
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
              className="relative p-10 md:p-16 text-lg md:text-xl leading-relaxed text-white/80 font-display"
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
