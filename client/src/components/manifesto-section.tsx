import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const manifestoLines = [
  "Aos cidadãos do Céu espalhados pela Terra, ouçam a voz da Embaixada que vos chama de volta à memória do Reino.",
  "A Kairós se estabelece como ponto de encontro entre dois mundos, levantada pelo Rei para lembrar que vocês não pertencem ao ritmo desta era, mas ao tempo eterno que governa todas as coisas.",
  "Erguemos esta casa para manifestar a cultura da Pátria Celestial em território estrangeiro, convertendo sopros em linguagem, visões em forma, decretos em obras.",
  "Aqui, nada é apenas arte: tudo é sinal.\nNada é apenas criação: tudo é convocação.\nNada é apenas beleza: tudo é anúncio do Rei que vem.",
  "Nós proclamamos sobre vocês:\nLembrem-se de quem são.\nLembrem-se de quem representam.\nLembrem-se do Reino ao qual pertencem.",
  "Vocês caminham entre nações, mas carregam a marca da eternidade nos ombros.",
  "A Kairós existe para tornar audível o que o Céu fala e visível o que o Céu revela. Marcas, livros, roupas, vídeos, sons, narrativas — tudo nasce como testemunho. Tudo carrega o código da Pátria. Tudo declara que o Reino está próximo.",
  "Enquanto o Céu continuar soprando, continuaremos ecoando.\nEnquanto houver brechas na Terra, continuaremos plantando sinais.\nE enquanto houver corações despertos, continuaremos chamando.",
  "Que aquele que tem ouvidos, ouça.\nO Rei está escrevendo história, e esta Embaixada existe para torná-la impossível de ignorar.",
];

export function ManifestoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const title = titleRef.current;
    if (!section || !title) return;

    // Title parallax — moves up at 50% speed
    const st = gsap.to(title, {
      y: -50,
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top bottom",
        end: "center top",
        scrub: 0.8,
      },
    });

    return () => {
      st.kill();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="manifesto"
      className="relative section-swiss text-white"
      style={{ overflow: "clip" }}
    >
      {/* Sticky video background — contained within section via overflow:clip */}
      <div className="sticky top-0 h-screen w-full -mb-screen pointer-events-none" aria-hidden style={{ marginBottom: "-100vh" }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/videoplayback.webm" type="video/webm" />
        </video>
        {/* Dark overlay — darker on mobile for readability in bright environments */}
        <div className="absolute inset-0 bg-black/65 md:bg-black/55" />
      </div>

      <div className="container mx-auto px-6 md:px-12 relative z-10">
        {/* Header — Swiss Style XL + GSAP parallax */}
        <div className="mb-24">
          <div className="overflow-hidden mb-8">
            <motion.span
              initial={{ y: 16, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-[hsl(38,60%,70%)] font-mono text-xs uppercase tracking-[0.3em] block"
            >
              Manifesto
            </motion.span>
          </div>
          <h2
            ref={titleRef}
            className="swiss-title-xl font-display font-bold italic text-[hsl(40,25%,88%)] gsap-parallax"
          >
            A voz da
            <br />
            <span className="text-[hsl(38,60%,72%)]">Embaixada</span>
          </h2>
        </div>

        <div className="max-w-4xl space-y-10 md:space-y-16">
          {manifestoLines.map((line, i) => {
            const isItalic = line.includes("\n");
            return (
              <motion.div
                key={i}
                initial={{ x: isItalic ? 0 : -20, opacity: 0, y: isItalic ? 20 : 0 }}
                whileInView={{ x: 0, opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: isItalic ? 1.0 : 0.8,
                  delay: 0.05,
                  ease: EASE,
                }}
              >
                {isItalic ? (
                  <p className="text-lg md:text-3xl leading-relaxed font-display italic text-[hsl(40,20%,82%)] whitespace-pre-line">
                    {line}
                  </p>
                ) : (
                  <p className="text-base md:text-xl leading-relaxed text-[hsl(40,15%,68%)]">
                    {line}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Decorative line — scaleX reveal left to right */}
        <div className="mt-28 flex items-center gap-6">
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.2, ease: EASE }}
            style={{ originX: 0 }}
            className="h-px flex-1 bg-gradient-to-r from-[hsl(38,60%,60%)]/50 to-transparent"
          />
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.8, ease: EASE }}
            className="text-[hsl(38,60%,70%)] font-display text-sm italic tracking-wide"
          >
            Kairós — Casa Criativa
          </motion.span>
        </div>
      </div>
    </section>
  );
}
