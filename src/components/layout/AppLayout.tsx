import { Sidebar } from "./Sidebar";
import { ThemeProvider } from "../theme-provider";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <ThemeProvider defaultTheme="light">
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        {/* Abstract animated background subtle touches */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50 mix-blend-multiply animate-pulse" />
          <div className="absolute top-1/2 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl opacity-50 mix-blend-multiply" style={{ animationDelay: '2s' }} />
        </div>

        <Sidebar />
        
        <main className="lg:pl-64 pt-14 lg:pt-0 min-h-screen relative z-10 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </ThemeProvider>
  );
}
