import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Phone, HardDrive, Users, CheckCircle2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend
} from "recharts";

// ── Codec data ──────────────────────────────────────────────────
const CODECS = [
  { id: "G.711",  label: "G.711 (PCM — 64 kbps)",   kbps: 64,  quality: "Standard",  color: "#3b82f6" },
  { id: "G.729",  label: "G.729 (Compressed — 8 kbps)", kbps: 8, quality: "Narrow",   color: "#10b981" },
  { id: "G.722",  label: "G.722 (HD — 64 kbps)",    kbps: 64,  quality: "HD Voice",  color: "#8b5cf6" },
  { id: "Opus",   label: "Opus (Modern — 32 kbps)",  kbps: 32,  quality: "Wideband",  color: "#f59e0b" },
];

// ── Brand recommendations ─────────────────────────────────────
interface SystemRec {
  model: string;
  maxUsers: string;
  maxChannels: string;
  features: string[];
}

const BRAND_RECS: Record<string, SystemRec[]> = {
  Avaya: [
    { model: "Avaya IP Office 500v2", maxUsers: "Up to 384",   maxChannels: "120",  features: ["Call Recording", "UC", "Voicemail", "IP & Digital"] },
    { model: "Avaya Aura Platform",    maxUsers: "250,000+",    maxChannels: "Unlimited", features: ["Enterprise UC", "Video", "Contact Center", "SIP Trunking"] },
  ],
  Panasonic: [
    { model: "KX-NSX1000",  maxUsers: "Up to 1,000", maxChannels: "256",  features: ["IP-PBX", "Mobility", "Unified Messaging", "SIP"] },
    { model: "KX-NS1000",   maxUsers: "Up to 500",   maxChannels: "128",  features: ["Hybrid IP", "Call Center", "Voicemail"] },
  ],
  NEC: [
    { model: "NEC SL2100",  maxUsers: "Up to 100",   maxChannels: "64",   features: ["Hybrid IP", "Built-in Voicemail", "UC Lite"] },
    { model: "NEC SV9300",  maxUsers: "Up to 2,000", maxChannels: "512",  features: ["Enterprise IP", "CC", "WebRTC", "Mobility"] },
  ],
  Custom: [
    { model: "Custom IP-PBX", maxUsers: "As defined", maxChannels: "As defined", features: ["Open-source (FreePBX/Asterisk)", "Full customization"] },
  ],
};

function getRecommendedModel(brand: string, users: number): SystemRec {
  const recs = BRAND_RECS[brand] ?? BRAND_RECS.Custom;
  if (brand === "Avaya") return users > 384 ? recs[1] : recs[0];
  if (brand === "Panasonic") return users > 500 ? recs[0] : recs[1];
  if (brand === "NEC") return users > 100 ? recs[1] : recs[0];
  return recs[0];
}

export default function Telephone() {
  const [brand,          setBrand]          = useState("Avaya");
  const [numUsers,       setNumUsers]       = useState(50);
  const [recChannels,    setRecChannels]    = useState(10);
  const [hoursPerDay,    setHoursPerDay]    = useState(8);
  const [codec,          setCodec]          = useState("G.711");
  const [recDays,        setRecDays]        = useState(90);

  const results = useMemo(() => {
    const codecInfo = CODECS.find(c => c.id === codec) || CODECS[0];
    // Storage per channel per hour in GB:
    // GB/hour = kbps × 1000 / 8 × 3600 / (1024^3)
    const gbPerChannelHour = (codecInfo.kbps * 1000 / 8 * 3600) / (1024 ** 3);
    const totalStorageGB = gbPerChannelHour * recChannels * hoursPerDay * recDays;
    const totalStorageTB = totalStorageGB / 1024;

    const recommended = getRecommendedModel(brand, numUsers);
    const sizeLabel = numUsers <= 50 ? "Small" : numUsers <= 500 ? "Medium" : "Large";

    // Pie chart: storage breakdown
    const pieData = [
      { name: "Recording Storage", value: parseFloat(totalStorageGB.toFixed(2)), color: "#3b82f6" },
      { name: "System OS + Logs",  value: parseFloat((totalStorageGB * 0.08).toFixed(2)), color: "#94a3b8" },
      { name: "Safety Buffer 20%", value: parseFloat((totalStorageGB * 0.20).toFixed(2)), color: "#e2e8f0" },
    ];
    const totalWithBuffer = totalStorageGB * 1.28; // +8% OS +20% safety

    return { totalStorageGB, totalStorageTB, recommended, sizeLabel, gbPerChannelHour, codecInfo, pieData, totalWithBuffer };
  }, [brand, numUsers, recChannels, hoursPerDay, codec, recDays]);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg text-teal-600 dark:text-teal-400">
            <Phone className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          Telephone System Calculator
        </h1>
        <p className="text-slate-500 mt-1 text-sm sm:text-base">Call recording storage estimator and system recommendation engine.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* ── LEFT: Inputs ── */}
        <Card className="xl:col-span-5 glass-card border-0 shadow-lg">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base sm:text-lg">System Parameters</CardTitle>
            <CardDescription>Configure brand, users and call recording settings</CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 space-y-5">
            {/* Brand */}
            <div className="space-y-2">
              <Label>System Brand</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {["Avaya", "Panasonic", "NEC", "Custom"].map(b => (
                  <button
                    key={b}
                    onClick={() => setBrand(b)}
                    className={`py-2.5 px-2 rounded-xl border-2 font-semibold text-xs sm:text-sm transition-all ${brand === b ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary/40'}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Users */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" /> Number of Users / Extensions
              </Label>
              <Input type="number" min={1} value={numUsers} onChange={e => setNumUsers(Number(e.target.value) || 1)} className="bg-white/50" />
            </div>

            {/* Recording */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs sm:text-sm">
                  Recording Channels
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent>Simultaneous recording channels</TooltipContent>
                  </Tooltip>
                </Label>
                <Input type="number" min={1} value={recChannels} onChange={e => setRecChannels(Number(e.target.value) || 1)} className="bg-white/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Recording Hours/Day</Label>
                <Input type="number" min={1} max={24} value={hoursPerDay} onChange={e => setHoursPerDay(Number(e.target.value) || 1)} className="bg-white/50" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Retention (Days)</Label>
                <Input type="number" min={1} value={recDays} onChange={e => setRecDays(Number(e.target.value) || 1)} className="bg-white/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Voice Codec</Label>
                <Select value={codec} onValueChange={setCodec}>
                  <SelectTrigger className="bg-white/50 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CODECS.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.id} — {c.kbps} kbps</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Codec info */}
            <div className="p-4 rounded-xl border-2 transition-all" style={{ borderColor: results.codecInfo.color, backgroundColor: results.codecInfo.color + '15' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm" style={{ color: results.codecInfo.color }}>{results.codecInfo.id}</span>
                <Badge style={{ backgroundColor: results.codecInfo.color }} className="text-white border-0 text-xs">{results.codecInfo.quality}</Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {results.codecInfo.kbps} kbps = {(results.gbPerChannelHour * 1024).toFixed(0)} MB / channel / hour
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── RIGHT: Results ── */}
        <div className="xl:col-span-7 space-y-5">
          {/* Storage Result */}
          <Card className="glass-card border-0 shadow-xl">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-teal-500" /> Storage Calculation
                </h2>
                <Badge variant="outline" className="text-xs">{results.sizeLabel} System</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                {/* Storage visual */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 relative overflow-hidden flex flex-col justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-cyan-500/5" />
                  <div className="relative">
                    <p className="text-slate-400 text-xs mb-2">Recording Storage (raw)</p>
                    {results.totalStorageTB >= 1 ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-display font-black text-teal-400">{results.totalStorageTB.toFixed(2)}</span>
                        <span className="text-xl text-teal-500 font-bold">TB</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-display font-black text-teal-400">{results.totalStorageGB.toFixed(0)}</span>
                        <span className="text-xl text-teal-500 font-bold">GB</span>
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-xs text-slate-400">Recommended (with 28% buffer)</p>
                      <p className="text-sm font-bold text-cyan-400">
                        {results.totalWithBuffer >= 1024
                          ? (results.totalWithBuffer / 1024).toFixed(2) + " TB"
                          : results.totalWithBuffer.toFixed(0) + " GB"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pie chart */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Storage breakdown</p>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={results.pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {results.pieData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <RTooltip formatter={(v: number) => [`${v.toFixed(1)} GB`, '']} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-mono text-xs text-slate-500">
                <strong className="text-primary">Formula:</strong> GB = (Codec_kbps × 1000/8 × 3600) / 1024³ × Channels × Hours × Days
              </div>
            </CardContent>
          </Card>

          {/* System Recommendation */}
          <Card className="glass-card border-0 shadow-lg">
            <CardContent className="p-5 sm:p-6">
              <h2 className="text-base font-bold mb-4 flex items-center gap-2">
                <Phone className="w-4 h-4 text-teal-500" /> Recommended System — {brand}
              </h2>
              <div className="p-4 sm:p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-primary">{results.recommended.model}</h3>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">Up to {results.recommended.maxUsers} users</Badge>
                    <Badge variant="outline" className="text-xs">{results.recommended.maxChannels} channels</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {results.recommended.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
