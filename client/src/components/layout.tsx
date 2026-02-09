import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText("HELLO@KAIROS.COM");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <nav className="fixed top-8 left-0 right-0 z-50 flex justify-center">
      <div className="flex items-center gap-2 p-1.5 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full">
        {/* Logo */}
        <Link href="/">
          <div className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors rounded-full cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        </Link>

        {/* About Tab */}
        <div 
          className="relative"
          onMouseEnter={() => setActiveTab('about')}
          onMouseLeave={() => setActiveTab(null)}
        >
          <button className={`px-6 py-2.5 text-sm font-medium transition-colors rounded-full ${activeTab === 'about' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}>
            About
          </button>
          <AnimatePresence>
            {activeTab === 'about' && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full left-0 mt-4 w-[320px] p-6 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] text-white shadow-2xl"
              >
                <div className="flex justify-between items-start mb-6">
                  <span className="text-xs font-bold uppercase tracking-widest opacity-50">About</span>
                  <Link href="/site"><span className="text-[10px] font-bold uppercase tracking-tighter hover:opacity-70 cursor-pointer">Visit Site</span></Link>
                </div>
                <p className="text-sm leading-relaxed mb-4 font-medium">
                  We believe brands are not to be reasoned with. They are hearts to be won. Brands should be felt, remembered and loved — irrationally so.
                </p>
                <p className="text-xs leading-relaxed opacity-60">
                  In the face of changing markets and technology, Kairos builds experiences that remain relevant and differentiated.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Work with us Tab */}
        <div 
          className="relative"
          onMouseEnter={() => setActiveTab('work')}
          onMouseLeave={() => setActiveTab(null)}
        >
          <button className={`px-6 py-2.5 text-sm font-medium transition-colors rounded-full ${activeTab === 'work' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}>
            Work with us
          </button>
          <AnimatePresence>
            {activeTab === 'work' && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[320px] p-6 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] text-white shadow-2xl"
              >
                <div className="mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest opacity-50 block mb-1">Work with us</span>
                  <p className="text-sm font-medium">Let's make some magic.</p>
                </div>
                <div className="flex items-center justify-between p-1 bg-white/10 rounded-full pl-4">
                  <span className="text-[10px] font-bold tracking-widest opacity-80">HELLO@KAIROS.COM</span>
                  <button 
                    onClick={copyEmail}
                    className="flex items-center justify-center w-10 h-10 bg-white/20 hover:bg-white/30 transition-colors rounded-full"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dots Menu */}
        <div 
          className="relative"
          onMouseEnter={() => setActiveTab('menu')}
          onMouseLeave={() => setActiveTab(null)}
        >
          <button className={`px-4 py-2.5 transition-colors rounded-full ${activeTab === 'menu' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
            <div className="flex gap-1">
              {[1,2,3,4,5,6].map(i => <div key={i} className="w-1 h-1 bg-white rounded-full opacity-60" />)}
            </div>
          </button>
          <AnimatePresence>
            {activeTab === 'menu' && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full right-0 mt-4 min-w-[160px] p-2 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl text-white shadow-2xl flex flex-col gap-1"
              >
                {['Visual System', 'Photography', 'Illustration', '3D', 'Website', 'Credits'].map(item => (
                  <button key={item} className="w-full text-left px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-white/10 rounded-full transition-colors opacity-70 hover:opacity-100">
                    {item}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="bg-foreground text-white py-20">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="space-y-6">
            <h3 className="text-2xl font-display font-bold">Kairos</h3>
            <p className="text-white/60 text-sm max-w-xs">
              Redefining urban mobility for the moments that matter.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-6">Company</h4>
            <ul className="space-y-4 text-sm text-white/60">
              <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Investors</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Press</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6">Resources</h4>
            <ul className="space-y-4 text-sm text-white/60">
              <li><a href="#" className="hover:text-white transition-colors">Safety</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Community</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Partners</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6">Stay Connected</h4>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors cursor-pointer">
                <span className="sr-only">Twitter</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"></path></svg>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors cursor-pointer">
                 <span className="sr-only">Instagram</span>
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeWidth="2"></rect><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" strokeWidth="2"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2"></line></svg>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-white/40">
          <p>© 2026 Kairos Aviation, Inc. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white">Privacy Policy</a>
            <a href="#" className="hover:text-white">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
