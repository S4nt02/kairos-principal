import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative h-screen w-full overflow-hidden bg-[#2a241e]">
      {/* Background Video Placeholder/Image */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/hero-aircraft.png"
          alt="Kairos Aircraft"
          className="w-full h-full object-cover opacity-60 mix-blend-overlay scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[1200px]"
        >
          <h1 className="text-7xl md:text-[140px] font-display font-medium text-white leading-[0.85] tracking-[-0.04em] mb-12">
            Kairos: A brand <br />
            designed to take <br />
            flight
          </h1>
          
          <div className="space-y-8 flex flex-col items-center">
             <p className="text-white text-sm md:text-base font-medium opacity-90 tracking-tight max-w-sm mx-auto">
               Sensory storytelling. Immersive design. <br />
               An experience, elevated.
             </p>
             
             <button className="flex flex-col items-center gap-4 group">
                <div className="px-8 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-sm font-bold tracking-widest uppercase hover:bg-white/20 transition-all">
                   Watch Reel
                </div>
             </button>
          </div>
        </motion.div>
      </div>
      
      {/* Scroll indicator or additional elements could go here */}
    </section>
  );
}

export function ContentBlock({ 
  title, 
  subtitle, 
  description, 
  image, 
  reverse = false 
}: { 
  title: string, 
  subtitle: string, 
  description: string, 
  image: string, 
  reverse?: boolean 
}) {
  return (
    <section className="py-32 bg-background">
      <div className="container mx-auto px-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <span className="text-primary font-mono text-sm uppercase tracking-widest mb-4 block">{subtitle}</span>
          <h2 className="text-5xl md:text-6xl font-display font-medium mb-12 leading-tight tracking-tight">{title}</h2>
          <div className="relative aspect-video overflow-hidden rounded-[2.5rem] shadow-2xl mb-12">
            <img src={image} alt={title} className="w-full h-full object-cover" />
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {description}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
