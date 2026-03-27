import { Link, useLocation } from "wouter";
import {
  Calculator, Home, History, Zap, Activity,
  Wifi, Moon, Sun, Menu, Flame, Camera, Phone, Volume2, X
} from "lucide-react";
import { useTheme } from "../theme-provider";
import { Button } from "../ui/button";
import { Sheet, SheetContent } from "../ui/sheet";
import { DialogTitle } from "../ui/dialog";
import { useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { href: "/",              label: "Home",            icon: Home },
  { href: "/fire-alarm",    label: "Fire Alarm LSN",  icon: Flame,    badge: "NEW" },
  { href: "/cctv",          label: "CCTV Calculator", icon: Camera,   badge: "NEW" },
  { href: "/telephone",     label: "Telephone System",icon: Phone,    badge: "NEW" },
  { href: "/pa",            label: "PA System",       icon: Volume2,  badge: "NEW" },
  { href: "/voltage-drop",  label: "Voltage Drop",    icon: Zap },
  { href: "/fiber-budget",  label: "Fiber Budget",    icon: Wifi },
  { href: "/inrush-current",label: "Inrush Current",  icon: Activity },
  { href: "/history",       label: "History",         icon: History },
];

export function Sidebar() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full py-5">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center shadow-lg shadow-primary/20 text-white flex-shrink-0">
          <Calculator className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-display font-bold text-base leading-none tracking-tight">Engineering</span>
          <span className="text-primary font-medium text-xs leading-none mt-0.5">Gift</span>
        </div>
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-sm",
                isActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/5 hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary")} />
              <span className="flex-1 truncate">{item.label}</span>
              {"badge" in item && item.badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none flex-shrink-0">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div className="px-5 pt-5 border-t border-border mt-auto flex justify-between items-center">
        <span className="text-xs font-medium text-muted-foreground">Theme</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full w-9 h-9 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10"
        >
          {theme === "dark"
            ? <Moon className="w-4 h-4 text-blue-400" />
            : <Sun className="w-4 h-4 text-orange-500" />}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile Top Bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 glass z-40 flex items-center px-4 justify-between border-b border-border no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center text-white flex-shrink-0">
            <Calculator className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-sm">Engineering Gift</span>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMobileOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* ── Mobile Drawer ── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 glass border-r-white/20">
          <DialogTitle className="sr-only">Navigation Menu</DialogTitle>
          <NavContent mobile />
        </SheetContent>
      </Sheet>

      {/* ── Desktop Sidebar ── */}
      <div className="hidden lg:block fixed inset-y-0 left-0 w-64 glass-card border-r border-slate-200/50 dark:border-white/10 z-40 bg-white/50 dark:bg-black/20 no-print">
        <NavContent />
      </div>
    </>
  );
}
