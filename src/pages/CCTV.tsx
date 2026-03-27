import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Camera, HardDrive, Info, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell
} from "recharts";

// ── DORI Constants ──────────────────────────────────────────────
const DORI_LEVELS = [
  { id: "detection",      label: "Detection",      ppm: 25,  color: "#10b981", desc: "Detect presence of a person or vehicle" },
  { id: "observation",   label: "Observation",    ppm: 62.5, color: "#3b82f6", desc: "Observe behaviour and activity" },
  { id: "recognition",   label: "Recognition",    ppm: 125,  color: "#f59e0b", desc: "Distinguish facial features" },
  { id: "identification", label: "Identification", ppm: 250,  color: "#ef4444", desc: "Identify a specific person beyond doubt" },
];

const RESOLUTION_OPTIONS = [
  { label: "2 MP (1920×1080)", mp: 2, px: 1920 },
  { label: "4 MP (2560×1440)", mp: 4, px: 2560 },
  { label: "5 MP (2592×1944)", mp: 5, px: 2592 },
  { label: "8 MP (3840×2160)", mp: 8, px: 3840 },
  { label: "12 MP (4000×3000)", mp: 12, px: 4000 },
];

// Sensor width in mm (1/2.8" sensor → 5.37mm wide)
const SENSOR_WIDTH_MM = 5.37;

function recommendCamera(level: string, focalMM: number, resolMp: number): string {
  if (level === "detection") return `Wide-angle Fixed Lens Dome, ${resolMp}MP`;
  if (level === "observation") return `Varifocal Bullet/Turret, ${resolMp}MP, ${focalMM.toFixed(1)}mm lens`;
  if (level === "recognition") return `Varifocal PTZ or Hi-res Dome, ${resolMp}MP, ${focalMM.toFixed(1)}mm lens`;
  return `PTZ High-res Identification Camera, ${resolMp}MP, ${focalMM.toFixed(1)}mm lens`;
}

// ── NVR Storage Constants ─────────────────────────────────────
// Bitrate table: [resolution_mp][fps] → Mbps (H.264)
const BITRATE_TABLE: Record<number, Record<number, number>> = {
  2:  { 15: 2.0,  25: 3.0,  30: 4.0 },
  4:  { 15: 4.0,  25: 6.0,  30: 8.0 },
  5:  { 15: 5.0,  25: 8.0,  30: 10.0 },
  8:  { 15: 8.0,  25: 14.0, 30: 18.0 },
  12: { 15: 12.0, 25: 20.0, 30: 25.0 },
};

const FPS_OPTIONS = [15, 25, 30];
const COMPRESSION_FACTOR: Record<string, number> = { "H.264": 1.0, "H.265": 0.55 };

export default function CCTV() {
  // ── Tab 1: DORI ───────────────────────────────────────────────
  const [distance, setDistance]     = useState(20);
  const [doriLevel, setDoriLevel]   = useState("recognition");
  const [resolution, setResolution] = useState(4);

  // ── Tab 2: NVR Storage ───────────────────────────────────────
  const [numCams,  setNumCams]  = useState(16);
  const [nvrRes,   setNvrRes]   = useState(4);
  const [fps,      setFps]      = useState(25);
  const [codec,    setCodec]    = useState("H.265");
  const [recDays,  setRecDays]  = useState(30);

  // DORI Calculation
  const doriResult = useMemo(() => {
    const level  = DORI_LEVELS.find(d => d.id === doriLevel) || DORI_LEVELS[2];
    const res    = RESOLUTION_OPTIONS.find(r => r.mp === resolution) || RESOLUTION_OPTIONS[1];
    const ppm    = level.ppm;

    // Scene width at distance for this PPM = res.px / ppm (meters)
    const sceneWidthM  = res.px / ppm;
    // HFOV in radians
    const hfov = 2 * Math.atan(sceneWidthM / (2 * distance));
    // Focal length in mm
    const focalMM = SENSOR_WIDTH_MM / (2 * Math.tan(hfov / 2));
    // Horizontal angle in degrees
    const hfovDeg = (hfov * 180) / Math.PI;
    // PPM achieved at this distance with recommended focal length
    const achievedPPM = res.px / sceneWidthM;

    const camera = recommendCamera(doriLevel, focalMM, resolution);

    return { ppm, sceneWidthM, focalMM, hfovDeg, achievedPPM, camera, levelLabel: level.label, levelColor: level.color };
  }, [distance, doriLevel, resolution]);

  // NVR Storage Calculation
  const nvrResult = useMemo(() => {
    const baseBitrate = BITRATE_TABLE[nvrRes]?.[fps] ?? 6;
    const bitrateMbps = baseBitrate * (COMPRESSION_FACTOR[codec] ?? 1.0);
    const storageBitsPerSecPerCam = bitrateMbps * 1_000_000;
    const storageBytesPerDay = (storageBitsPerSecPerCam / 8) * 86400;
    const storageTotalBytes = storageBytesPerDay * recDays * numCams;
    const storageGB = storageTotalBytes / (1024 ** 3);
    const storageTB = storageGB / 1024;

    // Per-camera breakdown for chart
    const perCamGb = storageGB / numCams;

    return { storageGB, storageTB, bitrateMbps, perCamGb };
  }, [numCams, nvrRes, fps, codec, recDays]);

  // Bar chart data: per-resolution comparison
  const storageChart = RESOLUTION_OPTIONS.map(r => {
    const b = (BITRATE_TABLE[r.mp]?.[fps] ?? 6) * (COMPRESSION_FACTOR[codec] ?? 1.0);
    const gb = (b * 1_000_000 / 8) * 86400 * recDays * numCams / (1024 ** 3);
    return { name: `${r.mp}MP`, gb: parseFloat(gb.toFixed(0)) };
  });

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400">
            <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          CCTV Calculator
        </h1>
        <p className="text-slate-500 mt-1 text-sm sm:text-base">Camera lens & resolution selector (DORI) + NVR storage estimator.</p>
      </div>

      <Tabs defaultValue="dori">
        <TabsList className="glass p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="dori" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-4 py-2">
            <Camera className="w-4 h-4 mr-2" /> Camera Selector (DORI)
          </TabsTrigger>
          <TabsTrigger value="nvr" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-4 py-2">
            <HardDrive className="w-4 h-4 mr-2" /> NVR Storage
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: DORI ── */}
        <TabsContent value="dori" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Inputs */}
            <Card className="lg:col-span-5 glass-card border-0 shadow-lg">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base sm:text-lg">Scene Parameters</CardTitle>
                <CardDescription>Configure target distance and required DORI level</CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Distance to Target (m)
                    <Tooltip>
                      <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent>Horizontal distance from camera to subject</TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input type="number" min={1} value={distance} onChange={e => setDistance(Number(e.target.value) || 1)} className="bg-white/50" />
                </div>

                <div className="space-y-2">
                  <Label>Required DORI Level</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DORI_LEVELS.map(l => (
                      <button
                        key={l.id}
                        onClick={() => setDoriLevel(l.id)}
                        className={`text-left p-3 rounded-xl border-2 transition-all text-sm ${doriLevel === l.id ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700 hover:border-primary/40'}`}
                      >
                        <div className="font-bold" style={{ color: l.color }}>{l.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{l.ppm} PPM</div>
                        <div className="text-xs text-slate-400 mt-1 leading-tight">{l.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Camera Resolution</Label>
                  <Select value={String(resolution)} onValueChange={v => setResolution(Number(v))}>
                    <SelectTrigger className="bg-white/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESOLUTION_OPTIONS.map(r => (
                        <SelectItem key={r.mp} value={String(r.mp)}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-900/40 text-xs text-violet-800 dark:text-violet-300">
                  <p className="font-semibold mb-1">DORI Standard (IEC 62676-4)</p>
                  <p>Pixels Per Meter (PPM) determines how many sensor pixels cover 1 meter of the scene at the specified distance.</p>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="lg:col-span-7 space-y-5">
              <Card className="glass-card border-0 shadow-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold">DORI Analysis Results</h2>
                    <Badge style={{ backgroundColor: doriResult.levelColor }} className="text-white border-0">
                      {doriResult.levelLabel}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 mb-1">Required PPM</p>
                      <p className="text-2xl sm:text-3xl font-display font-bold" style={{ color: doriResult.levelColor }}>{doriResult.ppm}</p>
                      <p className="text-xs text-slate-400 mt-1">pixels / meter</p>
                    </div>
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 mb-1">Focal Length</p>
                      <p className="text-2xl sm:text-3xl font-display font-bold text-primary">{doriResult.focalMM.toFixed(1)}</p>
                      <p className="text-xs text-slate-400 mt-1">mm lens</p>
                    </div>
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 mb-1">Scene Width at {distance}m</p>
                      <p className="text-2xl sm:text-3xl font-display font-bold text-slate-800 dark:text-slate-100">{doriResult.sceneWidthM.toFixed(2)}</p>
                      <p className="text-xs text-slate-400 mt-1">meters</p>
                    </div>
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 mb-1">Horizontal FOV</p>
                      <p className="text-2xl sm:text-3xl font-display font-bold text-slate-800 dark:text-slate-100">{doriResult.hfovDeg.toFixed(1)}°</p>
                      <p className="text-xs text-slate-400 mt-1">degrees</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 dark:bg-black text-white">
                    <p className="text-xs text-slate-400 mb-1 font-medium">Recommended Camera</p>
                    <p className="text-sm sm:text-base font-bold text-cyan-400">{doriResult.camera}</p>
                    <div className="mt-3 pt-3 border-t border-white/10 font-mono text-xs text-slate-400">
                      PPM = Horiz.Pixels / SceneWidth = {resolution}MP resolution / {doriResult.sceneWidthM.toFixed(2)}m = {doriResult.achievedPPM.toFixed(0)} PPM
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 2: NVR Storage ── */}
        <TabsContent value="nvr" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Inputs */}
            <Card className="lg:col-span-5 glass-card border-0 shadow-lg">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base sm:text-lg">System Configuration</CardTitle>
                <CardDescription>Configure cameras and recording parameters</CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Number of Cameras</Label>
                    <Input type="number" min={1} value={numCams} onChange={e => setNumCams(Number(e.target.value) || 1)} className="bg-white/50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Recording Days</Label>
                    <Input type="number" min={1} value={recDays} onChange={e => setRecDays(Number(e.target.value) || 1)} className="bg-white/50" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Camera Resolution</Label>
                  <Select value={String(nvrRes)} onValueChange={v => setNvrRes(Number(v))}>
                    <SelectTrigger className="bg-white/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESOLUTION_OPTIONS.map(r => (
                        <SelectItem key={r.mp} value={String(r.mp)}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frame Rate (FPS)</Label>
                    <Select value={String(fps)} onValueChange={v => setFps(Number(v))}>
                      <SelectTrigger className="bg-white/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FPS_OPTIONS.map(f => (
                          <SelectItem key={f} value={String(f)}>{f} fps</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Compression</Label>
                    <Select value={codec} onValueChange={setCodec}>
                      <SelectTrigger className="bg-white/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="H.264">H.264</SelectItem>
                        <SelectItem value="H.265">H.265 (Efficient)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300 space-y-1">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">Estimated Bitrate per Camera</p>
                  <p className="font-mono text-primary text-lg font-bold">{nvrResult.bitrateMbps.toFixed(2)} Mbps</p>
                  <p className="text-xs text-slate-400">H.265 reduces H.264 bitrate by ~45%</p>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="lg:col-span-7 space-y-5">
              <Card className="glass-card border-0 shadow-xl">
                <CardContent className="p-6 sm:p-8">
                  <h2 className="text-lg font-bold mb-6">Storage Requirements</h2>

                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-blue-500/10" />
                    <div className="relative">
                      <p className="text-slate-400 text-sm mb-2">Total Storage Required</p>
                      {nvrResult.storageTB >= 1 ? (
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-4xl sm:text-5xl font-display font-black text-violet-400">{nvrResult.storageTB.toFixed(2)}</span>
                          <span className="text-2xl text-violet-500 font-bold">TB</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-4xl sm:text-5xl font-display font-black text-violet-400">{nvrResult.storageGB.toFixed(0)}</span>
                          <span className="text-2xl text-violet-500 font-bold">GB</span>
                        </div>
                      )}
                      <p className="text-slate-400 text-sm">= {nvrResult.storageGB.toFixed(0)} GB total | {nvrResult.perCamGb.toFixed(0)} GB/camera</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Storage comparison by resolution ({numCams} cameras, {recDays} days, {fps}fps {codec})</p>
                    <div className="h-40 sm:h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={storageChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v >= 1000 ? (v/1024).toFixed(1)+'TB' : v+'GB'}`} />
                          <RTooltip formatter={(v: number) => [`${v >= 1024 ? (v/1024).toFixed(2)+' TB' : v+' GB'}`, 'Storage']} />
                          <Bar dataKey="gb" radius={[4, 4, 0, 0]}>
                            {storageChart.map((entry, idx) => (
                              <Cell key={idx} fill={entry.name === `${nvrRes}MP` ? '#7c3aed' : '#a78bfa'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-500">
                    <strong className="text-primary">Formula:</strong> Storage (GB) = Bitrate(Mbps) × 86400s × Days × Cameras / 8 / 1024³
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
