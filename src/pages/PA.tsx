import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Volume2, Plus, Trash2, ChevronDown, ChevronUp, Printer, Save,
  FileSpreadsheet, Info, Zap, Radio, Building2, Waves, BarChart3
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { saveToHistory } from "@/hooks/use-history";
import * as XLSX from "xlsx";

// ── Types ──────────────────────────────────────────────────────────────────
interface SpeakerLine {
  id: string;
  speakerKey: string;
  wattTap: number;
  quantity: number;
}

interface Zone {
  id: string;
  name: string;
  area: number;
  indoor: boolean;
  mountingHeight: number;
  ambientNoise: number;
  material: "concrete" | "glass" | "open";
  speakers: SpeakerLine[];
  expanded: boolean;
}

interface SpeakerSpec {
  model: string;
  type: "ceiling" | "horn" | "column" | "wall";
  sensitivity: number;
  maxPower: number;
  wattTaps: number[];
}

interface AmpSpec {
  model: string;
  power: number;
}

// ── Speaker & Amplifier Catalogs ──────────────────────────────────────────
const CATALOG: Record<string, SpeakerSpec[]> = {
  TOA: [
    { model: "F-2352C", type: "ceiling", sensitivity: 91, maxPower: 6,  wattTaps: [2.5, 6] },
    { model: "F-2000BT", type: "ceiling", sensitivity: 92, maxPower: 10, wattTaps: [2.5, 6, 10] },
    { model: "SC-630M",  type: "horn",    sensitivity: 107, maxPower: 30, wattTaps: [10, 20, 30] },
    { model: "CS-854",   type: "column",  sensitivity: 93, maxPower: 40, wattTaps: [10, 20, 40] },
    { model: "HY-1500",  type: "wall",    sensitivity: 90, maxPower: 15, wattTaps: [6, 10, 15] },
  ],
  Bosch: [
    { model: "LB1-UW12",  type: "ceiling", sensitivity: 89, maxPower: 12, wattTaps: [6, 12] },
    { model: "LBC3412/00",type: "horn",    sensitivity: 107, maxPower: 30, wattTaps: [10, 20, 30] },
    { model: "LC1-WC06E4",type: "column",  sensitivity: 96, maxPower: 6,  wattTaps: [2.5, 6] },
    { model: "LB2-UC30",  type: "ceiling", sensitivity: 91, maxPower: 30, wattTaps: [10, 20, 30] },
  ],
  Honeywell: [
    { model: "EV-CT60", type: "ceiling", sensitivity: 88, maxPower: 6,  wattTaps: [2.5, 6] },
    { model: "EV-HLS30",type: "horn",    sensitivity: 105, maxPower: 30, wattTaps: [10, 20, 30] },
    { model: "EV-CS120",type: "column",  sensitivity: 94, maxPower: 20, wattTaps: [10, 20] },
  ],
  Custom: [
    { model: "Ceiling 6W",  type: "ceiling", sensitivity: 90, maxPower: 6,  wattTaps: [2.5, 6] },
    { model: "Ceiling 10W", type: "ceiling", sensitivity: 90, maxPower: 10, wattTaps: [6, 10] },
    { model: "Ceiling 20W", type: "ceiling", sensitivity: 90, maxPower: 20, wattTaps: [10, 20] },
    { model: "Horn 30W",    type: "horn",    sensitivity: 105, maxPower: 30, wattTaps: [10, 20, 30] },
    { model: "Column 20W",  type: "column",  sensitivity: 93, maxPower: 20, wattTaps: [10, 20] },
  ],
};

const AMPLIFIERS: Record<string, AmpSpec[]> = {
  TOA: [
    { model: "A-2240", power: 240 }, { model: "A-2120", power: 120 },
    { model: "A-2060B", power: 60 }, { model: "A-2030B", power: 30 },
  ],
  Bosch: [
    { model: "PLE-1MA240", power: 240 }, { model: "PLE-1MA120", power: 120 },
    { model: "PLE-1MA060", power: 60 },
  ],
  Honeywell: [
    { model: "PA360", power: 360 }, { model: "PA120", power: 120 },
    { model: "PA60", power: 60 },
  ],
  Custom: [
    { model: "Amp 500W", power: 500 }, { model: "Amp 250W", power: 250 },
    { model: "Amp 120W", power: 120 }, { model: "Amp 60W", power: 60 },
    { model: "Amp 30W", power: 30 },
  ],
};

const BRANDS = ["TOA", "Bosch", "Honeywell", "Custom"] as const;
type Brand = typeof BRANDS[number];

const TYPE_ICONS: Record<string, string> = {
  ceiling: "⊙", horn: "📢", column: "▮", wall: "□",
};

// ── Calculation helpers ────────────────────────────────────────────────────
function calcSPL(sens: number, watt: number, distance: number): number {
  if (watt <= 0 || distance <= 0) return 0;
  return sens + 10 * Math.log10(watt) - 20 * Math.log10(distance);
}

function estimateSTI(indoor: boolean, material: Zone["material"], ambientNoise: number): {
  value: number; label: string; color: string;
} {
  let base = indoor
    ? material === "concrete" ? 0.65
    : material === "glass" ? 0.48
    : 0.55
    : 0.45;

  if (ambientNoise > 65) base -= 0.12;
  else if (ambientNoise > 55) base -= 0.06;

  const clamped = Math.min(0.9, Math.max(0.1, base));
  const label = clamped >= 0.75 ? "Excellent" : clamped >= 0.60 ? "Good" : clamped >= 0.45 ? "Fair" : "Poor";
  const color = clamped >= 0.75 ? "text-emerald-600" : clamped >= 0.60 ? "text-green-500" : clamped >= 0.45 ? "text-amber-500" : "text-red-500";
  return { value: clamped, label, color };
}

function recommendSpeaker(indoor: boolean, height: number, area: number): string {
  if (!indoor) return "Horn speaker — for outdoor coverage and weather resistance";
  if (height > 5) return "Column speaker — for long-throw in tall indoor spaces";
  if (height > 3.5 || area > 200) return "Ceiling speaker (high-power, 10W) — evenly distributed coverage";
  return "Ceiling speaker (6W) — standard ceiling-mounted, evenly spaced";
}

function zonePower(zone: Zone, catalog: SpeakerSpec[]): number {
  return zone.speakers.reduce((sum, sl) => {
    const spec = catalog.find(s => s.model === sl.speakerKey);
    if (!spec) return sum;
    return sum + sl.wattTap * sl.quantity;
  }, 0);
}

function createZone(num: number): Zone {
  return {
    id: crypto.randomUUID(),
    name: `Zone ${num}`,
    area: 100,
    indoor: true,
    mountingHeight: 3,
    ambientNoise: 50,
    material: "concrete",
    speakers: [],
    expanded: true,
  };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function PA() {
  const { toast } = useToast();
  const [brand, setBrand] = useState<Brand>("TOA");
  const [zones, setZones] = useState<Zone[]>([createZone(1)]);
  const [projectName, setProjectName] = useState("");
  const [engineer, setEngineer] = useState("");
  const [safetyFactor, setSafetyFactor] = useState(1.25);

  const catalog = CATALOG[brand];
  const amps = AMPLIFIERS[brand];

  // ── Zone helpers ────────────────────────────────────────────────────────
  const updateZone = useCallback(<K extends keyof Zone>(id: string, key: K, val: Zone[K]) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, [key]: val } : z));
  }, []);

  const toggleZone = useCallback((id: string) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, expanded: !z.expanded } : z));
  }, []);

  const addZone = () => setZones(prev => [...prev, createZone(prev.length + 1)]);
  const removeZone = (id: string) => setZones(prev => prev.filter(z => z.id !== id));

  const addSpeaker = (zoneId: string) => {
    const first = catalog[0];
    setZones(prev => prev.map(z => z.id !== zoneId ? z : {
      ...z,
      speakers: [...z.speakers, {
        id: crypto.randomUUID(),
        speakerKey: first.model,
        wattTap: first.wattTaps[0],
        quantity: 1,
      }]
    }));
  };

  const updateSpeaker = (zoneId: string, spId: string, patch: Partial<SpeakerLine>) => {
    setZones(prev => prev.map(z => z.id !== zoneId ? z : {
      ...z,
      speakers: z.speakers.map(s => s.id === spId ? { ...s, ...patch } : s),
    }));
  };

  const removeSpeaker = (zoneId: string, spId: string) => {
    setZones(prev => prev.map(z => z.id !== zoneId ? z : {
      ...z, speakers: z.speakers.filter(s => s.id !== spId)
    }));
  };

  // ── System-level calculations ───────────────────────────────────────────
  const results = useMemo(() => {
    const zoneResults = zones.map(zone => {
      const power = zonePower(zone, catalog);
      const sti = estimateSTI(zone.indoor, zone.material, zone.ambientNoise);
      const rec = recommendSpeaker(zone.indoor, zone.mountingHeight, zone.area);

      const speakersDetail = zone.speakers.map(sl => {
        const spec = catalog.find(s => s.model === sl.speakerKey);
        if (!spec) return null;
        const spl = calcSPL(spec.sensitivity, sl.wattTap, zone.mountingHeight);
        return { ...sl, spec, spl };
      }).filter(Boolean);

      const avgSPL = speakersDetail.length
        ? speakersDetail.reduce((s, d) => s + (d?.spl ?? 0), 0) / speakersDetail.length
        : 0;

      return { zone, power, sti, rec, speakersDetail, avgSPL };
    });

    const totalPower = zoneResults.reduce((s, z) => s + z.power, 0);
    const requiredAmpPower = totalPower * safetyFactor;

    let ampUnits: AmpSpec[] = [];
    let remaining = requiredAmpPower;
    const sortedAmps = [...amps].sort((a, b) => b.power - a.power);
    while (remaining > 0 && sortedAmps.length) {
      const best = sortedAmps.find(a => a.power <= remaining) || sortedAmps[sortedAmps.length - 1];
      ampUnits.push(best);
      remaining -= best.power;
    }

    const recommendedAmp = amps.find(a => a.power >= requiredAmpPower) || amps[0];

    return { zoneResults, totalPower, requiredAmpPower, ampUnits, recommendedAmp };
  }, [zones, catalog, amps, safetyFactor]);

  // ── Export helpers ──────────────────────────────────────────────────────
  const handlePrint = () => window.print();

  const handleSaveHistory = () => {
    saveToHistory({
      module: "PA System",
      projectName: projectName || undefined,
      inputs: {
        Brand: brand,
        Zones: zones.length,
        "Safety Factor": safetyFactor,
      },
      results: {
        "Total Power (W)": results.totalPower.toFixed(0),
        "Required Amp (W)": results.requiredAmpPower.toFixed(0),
        "Recommended Amp": results.recommendedAmp?.model || "N/A",
        "Zones": zones.length,
      },
    });
    toast({ title: "Saved!", description: "Calculation saved to history." });
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const info = [["Project", projectName], ["Engineer", engineer], ["Brand", brand], ["Safety Factor", safetyFactor]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), "Project Info");
    const rows = results.zoneResults.map(zr => ({
      Zone: zr.zone.name,
      "Area (m²)": zr.zone.area,
      "Indoor": zr.zone.indoor ? "Yes" : "No",
      "Height (m)": zr.zone.mountingHeight,
      "Noise (dB)": zr.zone.ambientNoise,
      "Speakers": zr.zone.speakers.reduce((s, sp) => s + sp.quantity, 0),
      "Zone Power (W)": zr.power.toFixed(1),
      "Avg SPL (dB)": zr.avgSPL.toFixed(1),
      "STI": zr.sti.value.toFixed(2),
      "STI Rating": zr.sti.label,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Zones");
    const sys = [["Total Power (W)", results.totalPower.toFixed(1)], ["Required Amp Power (W)", results.requiredAmpPower.toFixed(1)], ["Recommended Amp", results.recommendedAmp?.model]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sys), "System");
    XLSX.writeFile(wb, `PA_${projectName || "System"}.xlsx`);
    toast({ title: "Excel exported!" });
  };

  // ── SVG SLD ─────────────────────────────────────────────────────────────
  const SLD = () => {
    const W = 900, H = Math.max(300, 120 + zones.length * 90);
    const ampX = 40, ampY = H / 2 - 30, ampW = 120, ampH = 60;
    const zoneW = 160, zoneH = 54, zoneX = 220;
    const gap = (H - 60) / (zones.length + 1);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        {/* Amplifier */}
        <rect x={ampX} y={ampY} width={ampW} height={ampH} rx="8" fill="#0070f3" fillOpacity="0.15" stroke="#0070f3" strokeWidth="2" />
        <text x={ampX + ampW / 2} y={ampY + 20} textAnchor="middle" fill="#0070f3" fontSize="11" fontWeight="bold">AMPLIFIER</text>
        <text x={ampX + ampW / 2} y={ampY + 35} textAnchor="middle" fill="#0070f3" fontSize="9">{results.recommendedAmp?.model}</text>
        <text x={ampX + ampW / 2} y={ampY + 48} textAnchor="middle" fill="#0070f3" fontSize="9">{results.requiredAmpPower.toFixed(0)}W req.</text>

        {/* Main bus line */}
        <line x1={ampX + ampW} y1={H / 2} x2={zoneX} y2={H / 2} stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 3" />

        {zones.map((zone, i) => {
          const zy = gap * (i + 1) + 30 - zoneH / 2;
          const midX = zoneX;
          const speakerCount = zone.speakers.reduce((s, sp) => s + sp.quantity, 0);
          const zr = results.zoneResults[i];
          return (
            <g key={zone.id}>
              {/* Bus to zone branch line */}
              <line x1={midX} y1={H / 2} x2={midX} y2={zy + zoneH / 2} stroke="#94a3b8" strokeWidth="1.5" />
              {/* Zone box */}
              <rect x={zoneX} y={zy} width={zoneW} height={zoneH} rx="6" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x={zoneX + zoneW / 2} y={zy + 16} textAnchor="middle" fill="#1e293b" fontSize="10" fontWeight="bold">{zone.name}</text>
              <text x={zoneX + zoneW / 2} y={zy + 29} textAnchor="middle" fill="#64748b" fontSize="8">{zone.indoor ? "Indoor" : "Outdoor"} | {zone.area}m²</text>
              <text x={zoneX + zoneW / 2} y={zy + 41} textAnchor="middle" fill="#0070f3" fontSize="8">{zr.power.toFixed(0)}W | SPL≈{zr.avgSPL.toFixed(0)}dB</text>
              {/* Line to speakers */}
              <line x1={zoneX + zoneW} y1={zy + zoneH / 2} x2={zoneX + zoneW + 40} y2={zy + zoneH / 2} stroke="#94a3b8" strokeWidth="1.5" />
              {/* Speaker cluster */}
              {Array.from({ length: Math.min(speakerCount, 5) }).map((_, si) => {
                const sx = zoneX + zoneW + 50 + si * 38;
                const sy = zy + zoneH / 2;
                return (
                  <g key={si}>
                    <circle cx={sx} cy={sy} r="14" fill="#fefce8" stroke="#f59e0b" strokeWidth="1.5" />
                    <text x={sx} y={sy + 4} textAnchor="middle" fill="#92400e" fontSize="10">🔊</text>
                  </g>
                );
              })}
              {speakerCount > 5 && (
                <text x={zoneX + zoneW + 50 + 5 * 38 + 8} y={zy + zoneH / 2 + 4} fill="#94a3b8" fontSize="10">+{speakerCount - 5}</text>
              )}
              {speakerCount === 0 && (
                <text x={zoneX + zoneW + 50} y={zy + zoneH / 2 + 4} fill="#cbd5e1" fontSize="10">No speakers</text>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <rect x={W - 200} y={H - 44} width={190} height={38} rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
        <circle cx={W - 185} cy={H - 25} r="6" fill="#fefce8" stroke="#f59e0b" strokeWidth="1.5" />
        <text x={W - 175} y={H - 21} fill="#64748b" fontSize="8">Speaker</text>
        <rect x={W - 140} y={H - 33} width={18} height={14} rx="3" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
        <text x={W - 118} y={H - 21} fill="#64748b" fontSize="8">Zone</text>
        <rect x={W - 90} y={H - 33} width={18} height={14} rx="3" fill="#0070f3" fillOpacity="0.15" stroke="#0070f3" strokeWidth="1.5" />
        <text x={W - 68} y={H - 21} fill="#64748b" fontSize="8">Amplifier</text>
      </svg>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-8">
      {/* Print header */}
      <div className="print-header border-b-2 border-primary pb-3 mb-4">
        <h1 className="text-2xl font-bold text-primary">Engineering Gift — PA System Report</h1>
        <p className="text-sm text-slate-500">Brand: {brand} | Project: {projectName || "N/A"} | Engineer: {engineer || "N/A"}</p>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 no-print">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/25 flex-shrink-0">
            <Volume2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white">PA System Calculator</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Amplifier sizing, SPL, STI estimation & zone SLD</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 no-print-btn">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveHistory} className="gap-1.5">
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Project Config & Zones ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Project Info */}
          <Card className="glass-card border-0 shadow">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Project</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Project Name</Label>
                <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Enter project name" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Engineer</Label>
                <Input value={engineer} onChange={e => setEngineer(e.target.value)} placeholder="Engineer name" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">PA Brand</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {BRANDS.map(b => (
                    <button
                      key={b}
                      onClick={() => setBrand(b)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${brand === b ? "bg-primary text-white border-primary shadow" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                    >{b}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  Safety Margin
                  <Tooltip><TooltipTrigger><Info className="w-3 h-3" /></TooltipTrigger><TooltipContent>IEC 60849 recommends 1.25× (25%) minimum headroom on amplifier power.</TooltipContent></Tooltip>
                </Label>
                <div className="flex gap-2 mt-1">
                  {[1.20, 1.25, 1.30].map(f => (
                    <button key={f} onClick={() => setSafetyFactor(f)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${safetyFactor === f ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"}`}>
                      ×{f}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Summary card */}
          <Card className="glass-card border-0 shadow bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/10">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Summary</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-pink-600">{results.totalPower.toFixed(0)}<span className="text-sm font-normal ml-1">W</span></p>
                  <p className="text-xs text-muted-foreground">Total Load</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-rose-600">{results.requiredAmpPower.toFixed(0)}<span className="text-sm font-normal ml-1">W</span></p>
                  <p className="text-xs text-muted-foreground">Required Amp</p>
                </div>
              </div>
              {results.recommendedAmp && (
                <div className="mt-2 p-2 bg-white/60 dark:bg-slate-900/40 rounded-lg text-xs">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Recommended: {results.recommendedAmp.model}</p>
                  <p className="text-muted-foreground">{results.recommendedAmp.power}W • {brand}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Zone */}
          <Button onClick={addZone} className="w-full gap-2 no-print-btn" variant="outline">
            <Plus className="w-4 h-4" /> Add Zone
          </Button>
        </div>

        {/* ── Right: Zones + Tabs ── */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="zones">
            <TabsList className="w-full grid grid-cols-4 no-print">
              <TabsTrigger value="zones" className="text-xs gap-1"><Radio className="w-3 h-3" /> Zones</TabsTrigger>
              <TabsTrigger value="results" className="text-xs gap-1"><BarChart3 className="w-3 h-3" /> Results</TabsTrigger>
              <TabsTrigger value="diagram" className="text-xs gap-1"><Waves className="w-3 h-3" /> SLD</TabsTrigger>
              <TabsTrigger value="export" className="text-xs gap-1"><FileSpreadsheet className="w-3 h-3" /> Export</TabsTrigger>
            </TabsList>

            {/* ZONES TAB */}
            <TabsContent value="zones" className="space-y-3 mt-4">
              <AnimatePresence>
                {zones.map((zone, zi) => {
                  const zr = results.zoneResults[zi];
                  return (
                    <motion.div key={zone.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                      <Card className="glass-card border border-slate-200/60 dark:border-white/5 shadow">
                        {/* Zone Header */}
                        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                          <div className="flex-1 flex items-center gap-2">
                            <Input
                              value={zone.name}
                              onChange={e => updateZone(zone.id, "name", e.target.value)}
                              className="font-semibold h-8 text-sm w-28 bg-transparent border-0 border-b rounded-none px-0 focus-visible:ring-0"
                            />
                            <Badge variant="outline" className={`text-xs ${zone.indoor ? "text-blue-600 border-blue-300" : "text-orange-600 border-orange-300"}`}>
                              {zone.indoor ? "Indoor" : "Outdoor"}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-pink-600 border-pink-300">
                              {zr.power.toFixed(0)}W
                            </Badge>
                          </div>
                          <button onClick={() => toggleZone(zone.id)} className="text-muted-foreground hover:text-foreground">
                            {zone.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          {zones.length > 1 && (
                            <button onClick={() => removeZone(zone.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <AnimatePresence>
                          {zone.expanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                              <CardContent className="pt-2 space-y-3 border-t border-border/40">
                                {/* Zone Params */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Area (m²)</Label>
                                    <Input type="number" value={zone.area} onChange={e => updateZone(zone.id, "area", +e.target.value)} className="mt-1 h-8 text-sm" />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Mount Height (m)</Label>
                                    <Input type="number" step="0.5" value={zone.mountingHeight} onChange={e => updateZone(zone.id, "mountingHeight", +e.target.value)} className="mt-1 h-8 text-sm" />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Ambient Noise (dB)</Label>
                                    <Input type="number" value={zone.ambientNoise} onChange={e => updateZone(zone.id, "ambientNoise", +e.target.value)} className="mt-1 h-8 text-sm" />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Indoor / Outdoor</Label>
                                    <div className="flex gap-2 mt-1">
                                      {[true, false].map(v => (
                                        <button key={String(v)} onClick={() => updateZone(zone.id, "indoor", v)}
                                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${zone.indoor === v ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"}`}>
                                          {v ? "Indoor" : "Outdoor"}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Material</Label>
                                    <Select value={zone.material} onValueChange={v => updateZone(zone.id, "material", v as Zone["material"])}>
                                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="concrete">Concrete</SelectItem>
                                        <SelectItem value="glass">Glass/Reflective</SelectItem>
                                        <SelectItem value="open">Open Space</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                {/* Speaker recommendation */}
                                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/50">
                                  <span className="font-semibold text-primary">Rec: </span>{zr.rec}
                                </div>

                                {/* Speakers in zone */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Speakers</p>
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 no-print-btn" onClick={() => addSpeaker(zone.id)}>
                                      <Plus className="w-3 h-3" /> Add Speaker
                                    </Button>
                                  </div>
                                  {zone.speakers.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-2">No speakers yet. Click "Add Speaker".</p>
                                  )}
                                  {zone.speakers.map(sl => {
                                    const spec = catalog.find(s => s.model === sl.speakerKey);
                                    return (
                                      <div key={sl.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50/50 dark:bg-slate-800/30 rounded-lg px-2 py-2 border border-slate-100 dark:border-slate-700/40">
                                        <div className="col-span-5">
                                          <Select value={sl.speakerKey} onValueChange={v => {
                                            const newSpec = catalog.find(s => s.model === v);
                                            updateSpeaker(zone.id, sl.id, { speakerKey: v, wattTap: newSpec?.wattTaps[0] ?? sl.wattTap });
                                          }}>
                                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              {catalog.map(s => (
                                                <SelectItem key={s.model} value={s.model}>
                                                  <span className="mr-1">{TYPE_ICONS[s.type]}</span>{s.model}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="col-span-3">
                                          <Select value={String(sl.wattTap)} onValueChange={v => updateSpeaker(zone.id, sl.id, { wattTap: +v })}>
                                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              {(spec?.wattTaps || [sl.wattTap]).map(w => (
                                                <SelectItem key={w} value={String(w)}>{w}W</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="col-span-3">
                                          <Input type="number" min={1} value={sl.quantity}
                                            onChange={e => updateSpeaker(zone.id, sl.id, { quantity: Math.max(1, +e.target.value) })}
                                            className="h-7 text-xs text-center" />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                          <button onClick={() => removeSpeaker(zone.id, sl.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </CardContent>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </TabsContent>

            {/* RESULTS TAB */}
            <TabsContent value="results" className="mt-4 space-y-4">
              {/* Amplifier recommendation */}
              <Card className="glass-card border-0 shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" /> Amplifier Sizing</CardTitle>
                  <CardDescription>IEC 60849 safety margin: ×{safetyFactor}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                    <div className="glass-card rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{results.totalPower.toFixed(0)}<span className="text-sm font-normal ml-0.5">W</span></p>
                      <p className="text-xs text-muted-foreground">Total Speaker Load</p>
                    </div>
                    <div className="glass-card rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-rose-600">{results.requiredAmpPower.toFixed(0)}<span className="text-sm font-normal ml-0.5">W</span></p>
                      <p className="text-xs text-muted-foreground">Required Amp Power</p>
                    </div>
                    <div className="glass-card rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                      <p className="text-lg font-bold text-emerald-600">{results.recommendedAmp?.model || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">{results.recommendedAmp?.power}W — {brand}</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-700/40">
                    <span className="font-semibold">Formula: </span>Required = Total Load ({results.totalPower.toFixed(0)}W) × {safetyFactor} = {results.requiredAmpPower.toFixed(0)}W
                  </div>
                </CardContent>
              </Card>

              {/* Per-zone SPL & STI table */}
              <Card className="glass-card border-0 shadow overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Waves className="w-4 h-4 text-blue-500" /> Zone SPL & STI Analysis</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs text-muted-foreground">
                          <th className="px-4 py-2 text-left font-semibold">Zone</th>
                          <th className="px-3 py-2 text-right font-semibold">Power</th>
                          <th className="px-3 py-2 text-right font-semibold">Avg SPL</th>
                          <th className="px-3 py-2 text-right font-semibold">STI</th>
                          <th className="px-3 py-2 text-left font-semibold">Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.zoneResults.map((zr, i) => (
                          <tr key={i} className="border-t border-border/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{zr.zone.name}</td>
                            <td className="px-3 py-2.5 text-right text-pink-600 font-semibold">{zr.power.toFixed(0)}W</td>
                            <td className="px-3 py-2.5 text-right font-semibold">{zr.avgSPL > 0 ? `${zr.avgSPL.toFixed(1)} dB` : "—"}</td>
                            <td className="px-3 py-2.5 text-right font-semibold">{zr.sti.value.toFixed(2)}</td>
                            <td className={`px-3 py-2.5 font-semibold ${zr.sti.color}`}>{zr.sti.label}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Per-zone detail */}
              <div className="space-y-3">
                {results.zoneResults.map((zr, i) => (
                  <Card key={i} className="glass-card border-0 shadow">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{zr.zone.name} — Speaker Detail</CardTitle>
                      <Badge variant="outline" className={zr.sti.color}>STI: {zr.sti.label}</Badge>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {zr.zone.speakers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No speakers in this zone.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground text-left">
                              <th className="py-1 font-medium">Model</th>
                              <th className="py-1 text-center font-medium">Tap</th>
                              <th className="py-1 text-center font-medium">Qty</th>
                              <th className="py-1 text-right font-medium">SPL@{zr.zone.mountingHeight}m</th>
                              <th className="py-1 text-right font-medium">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {zr.speakersDetail.map((sd, si) => sd && (
                              <tr key={si} className="border-t border-border/30">
                                <td className="py-1.5 font-medium text-slate-700 dark:text-slate-300">{sd.speakerKey}</td>
                                <td className="py-1.5 text-center text-muted-foreground">{sd.wattTap}W</td>
                                <td className="py-1.5 text-center text-muted-foreground">×{sd.quantity}</td>
                                <td className="py-1.5 text-right text-blue-600 font-semibold">{sd.spl.toFixed(1)} dB</td>
                                <td className="py-1.5 text-right text-pink-600 font-semibold">{(sd.wattTap * sd.quantity).toFixed(0)}W</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <div className="mt-2 text-xs text-muted-foreground bg-slate-50 dark:bg-slate-800/30 rounded-lg p-2 border border-slate-100 dark:border-slate-700/40">
                        {zr.rec}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* DIAGRAM TAB */}
            <TabsContent value="diagram" className="mt-4">
              <Card className="glass-card border-0 shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Waves className="w-4 h-4 text-primary" /> Zone Single Line Diagram</CardTitle>
                  <CardDescription>Amplifier → zones → speakers layout</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-5">
                  <SLD />
                </CardContent>
              </Card>
            </TabsContent>

            {/* EXPORT TAB */}
            <TabsContent value="export" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Card className="glass-card border-0 shadow hover:shadow-xl transition-all hover:-translate-y-1 group cursor-pointer" onClick={handlePrint}>
                  <CardContent className="p-8 text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Printer className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold font-display">Print Report</h3>
                    <p className="text-slate-500 text-sm">Opens browser print dialog with a clean full-page layout including SLD diagram.</p>
                    <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm">Print / Save PDF</Button>
                  </CardContent>
                </Card>
                <Card className="glass-card border-0 shadow hover:shadow-xl transition-all hover:-translate-y-1 group cursor-pointer" onClick={handleExportExcel}>
                  <CardContent className="p-8 text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileSpreadsheet className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold font-display">Export Excel</h3>
                    <p className="text-slate-500 text-sm">Download zones, speakers and system summary as an XLSX file.</p>
                    <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-sm">Download Excel</Button>
                  </CardContent>
                </Card>
                <Card className="glass-card border-0 shadow hover:shadow-xl transition-all hover:-translate-y-1 group cursor-pointer" onClick={handleSaveHistory}>
                  <CardContent className="p-8 text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Save className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold font-display">Save to History</h3>
                    <p className="text-slate-500 text-sm">Save this calculation to your browser history for future reference.</p>
                    <Button className="w-full bg-violet-500 hover:bg-violet-600 text-white rounded-full text-sm">Save Calculation</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
