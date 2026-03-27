import { Link } from "wouter";
import { motion } from "framer-motion";
import { Zap, Wifi, Activity, BookOpen, Flame, Camera, Phone, Volume2, User } from "lucide-react";

const tools = [
  {
    title: "Fire Alarm LSN",
    description: "Full LSN loop design: brands, devices, voltage drop per loop, battery sizing, and SLD generation.",
    icon: Flame,
    href: "/fire-alarm",
    color: "from-red-500 to-orange-500",
    shadow: "shadow-red-500/20",
    badge: "NEW"
  },
  {
    title: "CCTV Calculator",
    description: "DORI camera selection tool and NVR storage calculator for surveillance system design.",
    icon: Camera,
    href: "/cctv",
    color: "from-violet-500 to-purple-600",
    shadow: "shadow-purple-500/20",
    badge: "NEW"
  },
  {
    title: "Telephone System",
    description: "Telephony system design: brand selection, call recording storage, and system recommendation.",
    icon: Phone,
    href: "/telephone",
    color: "from-teal-500 to-emerald-500",
    shadow: "shadow-teal-500/20",
    badge: "NEW"
  },
  {
    title: "PA System",
    description: "Amplifier sizing, SPL/STI calculation, speaker recommendation, and zone single line diagram.",
    icon: Volume2,
    href: "/pa",
    color: "from-pink-500 to-rose-500",
    shadow: "shadow-pink-500/20",
    badge: "NEW"
  },
  {
    title: "Voltage Drop Calculator",
    description: "Calculate voltage drop for fire alarms and standard cables over distance.",
    icon: Zap,
    href: "/voltage-drop",
    color: "from-blue-500 to-cyan-400",
    shadow: "shadow-blue-500/20"
  },
  {
    title: "Fiber Optic Link Budget",
    description: "Determine total loss and link margin for your fiber optic networks.",
    icon: Wifi,
    href: "/fiber-budget",
    color: "from-indigo-500 to-purple-500",
    shadow: "shadow-purple-500/20"
  },
  {
    title: "Inrush Current",
    description: "Estimate inrush current peaks and select appropriate circuit breakers with B/C/D curve charts.",
    icon: Activity,
    href: "/inrush-current",
    color: "from-orange-500 to-amber-400",
    shadow: "shadow-orange-500/20"
  }
];

export default function Home() {
  return (
    <div className="space-y-10 pb-12">
      {/* Hero Section */}
      <section className="relative rounded-3xl overflow-hidden glass-card p-6 sm:p-10 md:p-16 border-0 shadow-2xl">
        <div className="absolute inset-0 z-0">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt="Abstract tech background"
            className="w-full h-full object-cover opacity-80 dark:opacity-40 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-white/90 dark:from-black/40 dark:to-slate-950/90" />
        </div>

        <div className="relative z-10 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm mb-5 border border-primary/20 backdrop-blur-md">
              <Zap className="w-4 h-4" />
              <span>Smart ELV Calculations v2.0</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-display font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
              Engineering <span className="text-gradient">Gift</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-2 max-w-2xl leading-relaxed">
              Design, calculate, and optimize your engineering systems.
            </p>
            <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 mb-7 font-medium">
              بسهولة واحترافية (Easily and professionally)
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href="https://mohamedawyes.github.io/Awyes_portfolio/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl font-semibold bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-200 text-sm sm:text-base"
              >
                <User className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                About Us
              </a>
              <Link
                href="/history"
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl font-semibold glass hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-200 text-slate-700 dark:text-slate-200 text-sm sm:text-base"
              >
                <BookOpen className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                View History
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tools Grid */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-8 rounded-full bg-primary" />
          <h2 className="text-xl sm:text-2xl font-bold font-display">Calculation Modules</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {tools.map((tool, index) => (
            <motion.div
              key={tool.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.08 }}
            >
              <Link href={tool.href}>
                <div className="group h-full p-5 sm:p-6 rounded-2xl sm:rounded-3xl glass-card hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 cursor-pointer border border-slate-200/50 dark:border-white/5 relative">
                  {"badge" in tool && tool.badge && (
                    <span className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">
                      {tool.badge}
                    </span>
                  )}
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl mb-4 sm:mb-6 flex items-center justify-center bg-gradient-to-br ${tool.color} shadow-lg ${tool.shadow}`}>
                    <tool.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
                    {tool.description}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
