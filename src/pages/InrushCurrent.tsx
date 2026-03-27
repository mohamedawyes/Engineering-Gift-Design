import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Calculator, Sparkles, Activity, Zap } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from "recharts";

const STANDARD_BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250];

// ── Breaker Curve Data (IEC 60898) ──────────────────────────────
// X = multiples of In, Y = approximate trip time (seconds)
// Thermal zone: t ≈ 2/(i-1)^2 (simplified inverse-time)
// Magnetic zone: instantaneous at respective band
function thermalTime(i: number): number {
  if (i <= 1.05) return 3600;
  return Math.min(3600, 2.5 / ((i - 1) ** 2));
}

const CURVE_POINTS = [1.1, 1.2, 1.3, 1.5, 1.7, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25];

function buildCurveData(lowTrip: number, highTrip: number): { x: number; time: number }[] {
  const pts: { x: number; time: number }[] = [];
  for (const i of CURVE_POINTS) {
    if (i < lowTrip) {
      pts.push({ x: i, time: thermalTime(i) });
    } else if (i >= lowTrip && i < highTrip) {
      // Transition to instantaneous (short delay 0.02–0.1s)
      const t = 0.1 - ((i - lowTrip) / (highTrip - lowTrip)) * 0.08;
      pts.push({ x: i, time: parseFloat(t.toFixed(4)) });
    } else {
      pts.push({ x: i, time: 0.01 });
    }
  }
  return pts;
}

const bCurveRaw = buildCurveData(3, 5);
const cCurveRaw = buildCurveData(5, 10);
const dCurveRaw = buildCurveData(10, 20);

// Merge into unified chart dataset
const chartData = CURVE_POINTS.map((x, idx) => ({
  x,
  label: `${x}×In`,
  B: bCurveRaw[idx].time,
  C: cCurveRaw[idx].time,
  D: dCurveRaw[idx].time,
}));

const CURVE_INFO: Record<string, { color: string; desc: string; range: string }> = {
  "Type B": { color: "#3b82f6", desc: "Low inrush loads: resistive heating, incandescent lighting", range: "Instantaneous at 3–5× In" },
  "Type C": { color: "#f59e0b", desc: "General purpose: motors, transformers, mixed loads",         range: "Instantaneous at 5–10× In" },
  "Type D": { color: "#ef4444", desc: "High inrush: LED drivers, capacitor banks, welding units",   range: "Instantaneous at 10–20× In" },
};

// Custom Y-axis formatter (log-friendly labels)
function formatTime(v: number): string {
  if (v >= 3600) return "1h";
  if (v >= 60)   return `${(v / 60).toFixed(0)}m`;
  if (v >= 1)    return `${v.toFixed(0)}s`;
  return `${(v * 1000).toFixed(0)}ms`;
}

export default function InrushCurrent() {
  const [loadType, setLoadType]     = useState<"motor" | "transformer" | "led" | "capacitor">("motor");
  const [ratedCurrent, setRatedCurrent] = useState(10);
  const [powerFactor, setPowerFactor]   = useState(0.85);

  const multiplierMap = { motor: 7, transformer: 10, led: 60, capacitor: 30 };

  const results = useMemo(() => {
    const multiplier = multiplierMap[loadType];
    const inrush     = ratedCurrent * multiplier;

    let breakerCurve = "Type C";
    if (multiplier < 5)  breakerCurve = "Type B";
    if (multiplier > 10) breakerCurve = "Type D";

    const suggestedRating = STANDARD_BREAKERS.find(b => b > ratedCurrent) || STANDARD_BREAKERS[STANDARD_BREAKERS.length - 1];

    // Calculate approximate trip time at inrush for selected curve
    const inrushMultiple = inrush / ratedCurrent;
    const clampedMultiple = Math.min(25, inrushMultiple);

    return { inrush: inrush.toFixed(1), multiplier, breakerCurve, suggestedRating: `${suggestedRating}A`, inrushMultiple: clampedMultiple };
  }, [loadType, ratedCurrent]);

  const handleDemo = () => { setLoadType("motor"); setRatedCurrent(15); setPowerFactor(0.8); };

  const selectedCurveColor = CURVE_INFO[results.breakerCurve]?.color ?? "#f59e0b";

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            Inrush Current
          </h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Estimate peak currents and select breakers with IEC 60898 curves.</p>
        </div>
        <Button variant="outline" onClick={handleDemo} className="glass-card hover:bg-primary/5 self-start sm:self-auto">
          <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
          Example Values
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Inputs ── */}
        <Card className="lg:col-span-4 glass-card shadow-lg border-0">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 rounded-t-xl border-b border-border">
            <CardTitle className="text-base sm:text-lg">Load Details</CardTitle>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 space-y-5">
            <div className="space-y-2">
              <Label>Equipment Load Type</Label>
              <Select value={loadType} onValueChange={(v: any) => setLoadType(v)}>
                <SelectTrigger className="bg-white/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="motor">Induction Motor (DOL)</SelectItem>
                  <SelectItem value="transformer">Transformer</SelectItem>
                  <SelectItem value="led">LED Lighting (Driver)</SelectItem>
                  <SelectItem value="capacitor">Capacitor Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Rated Current (A)
                <Tooltip>
                  <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent>Steady-state operating current</TooltipContent>
                </Tooltip>
              </Label>
              <Input type="number" value={ratedCurrent} onChange={e => setRatedCurrent(Number(e.target.value) || 0)} className="bg-white/50" />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Power Factor
                <Tooltip>
                  <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent>For report reference only</TooltipContent>
                </Tooltip>
              </Label>
              <Input type="number" step="0.01" max="1" min="0" value={powerFactor} onChange={e => setPowerFactor(Number(e.target.value) || 0)} className="bg-white/50" />
            </div>

            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Inrush Multipliers</p>
              {[
                { label: "Motor (DOL)", range: "6–8×", active: loadType === "motor" },
                { label: "Transformer",  range: "8–12×", active: loadType === "transformer" },
                { label: "LED Drivers",  range: "50–100×", active: loadType === "led" },
                { label: "Capacitors",   range: "20–50×", active: loadType === "capacitor" },
              ].map(({ label, range, active }) => (
                <div key={label} className={`flex justify-between text-xs py-0.5 ${active ? 'text-primary font-bold' : ''}`}>
                  <span>{label}</span><span>{range}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Results + Chart ── */}
        <div className="lg:col-span-8 space-y-5">
          {/* Result cards */}
          <Card className="glass-card shadow-xl border-0 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
            <CardContent className="p-5 sm:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-orange-500" /> Circuit Breaker Selection
                </h2>
                <Badge
                  className="text-white border-0 font-bold"
                  style={{ backgroundColor: selectedCurveColor }}
                >
                  {results.breakerCurve}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div className="sm:col-span-1 p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 mb-1">Inrush Current</p>
                  <div className="flex items-end gap-1">
                    <p className="text-3xl sm:text-4xl font-display font-bold text-orange-500">{results.inrush}</p>
                    <span className="text-lg text-slate-400 font-bold mb-0.5">A</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{results.multiplier}× multiplier</p>
                </div>
                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                  <p className="text-xs text-slate-500 mb-1">Suggested Breaker</p>
                  <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">{results.suggestedRating}</p>
                  <p className="text-xs text-slate-400 mt-1">next standard above {ratedCurrent}A</p>
                </div>
                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                  <p className="text-xs text-slate-500 mb-1">Tripping Curve</p>
                  <p className="text-2xl font-display font-bold" style={{ color: selectedCurveColor }}>{results.breakerCurve}</p>
                  <p className="text-xs text-slate-400 mt-1">{CURVE_INFO[results.breakerCurve]?.range}</p>
                </div>
              </div>

              <div className="p-3 sm:p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/50 text-xs sm:text-sm font-mono text-orange-800 dark:text-orange-300">
                <Zap className="w-3.5 h-3.5 inline mr-1" />
                <strong>Formula:</strong> Inrush = {ratedCurrent}A × {results.multiplier} = {results.inrush}A &nbsp;|&nbsp; {results.breakerCurve}: instantaneous {CURVE_INFO[results.breakerCurve]?.range}
              </div>
            </CardContent>
          </Card>

          {/* ── Breaker Curve Chart ── */}
          <Card className="glass-card shadow-xl border-0">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <CardTitle className="text-base sm:text-lg">IEC 60898 Time-Current Characteristics</CardTitle>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                X-axis: Current multiple (×In) &nbsp;·&nbsp; Y-axis: Trip time (seconds) &nbsp;·&nbsp;
                <span style={{ color: selectedCurveColor }} className="font-bold"> Highlighted: {results.breakerCurve}</span>
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="h-60 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="x"
                      label={{ value: "× Rated Current (In)", position: "insideBottom", offset: -5, fontSize: 11 }}
                      tick={{ fontSize: 10 }}
                      tickFormatter={v => `${v}×`}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={formatTime}
                      label={{ value: "Trip Time", angle: -90, position: "insideLeft", offset: 15, fontSize: 11 }}
                      domain={[0.01, 3700]}
                      scale="log"
                      allowDataOverflow
                    />
                    <RTooltip
                      formatter={(v: number, name: string) => [formatTime(v), `Type ${name} Curve`]}
                      labelFormatter={v => `${v}× rated current`}
                    />
                    <Legend
                      formatter={(v) => `Type ${v} Curve`}
                      wrapperStyle={{ fontSize: 11 }}
                    />

                    {/* Inrush operating point reference line */}
                    <ReferenceLine
                      x={Math.min(25, results.inrushMultiple)}
                      stroke={selectedCurveColor}
                      strokeDasharray="5 3"
                      strokeWidth={2}
                      label={{ value: `${results.multiplier}×In`, position: "top", fontSize: 10, fill: selectedCurveColor }}
                    />

                    <Line
                      type="monotone"
                      dataKey="B"
                      stroke={results.breakerCurve === "Type B" ? CURVE_INFO["Type B"].color : "#93c5fd"}
                      strokeWidth={results.breakerCurve === "Type B" ? 3 : 1.5}
                      dot={false}
                      strokeDasharray={results.breakerCurve === "Type B" ? "0" : "4 2"}
                    />
                    <Line
                      type="monotone"
                      dataKey="C"
                      stroke={results.breakerCurve === "Type C" ? CURVE_INFO["Type C"].color : "#fcd34d"}
                      strokeWidth={results.breakerCurve === "Type C" ? 3 : 1.5}
                      dot={false}
                      strokeDasharray={results.breakerCurve === "Type C" ? "0" : "4 2"}
                    />
                    <Line
                      type="monotone"
                      dataKey="D"
                      stroke={results.breakerCurve === "Type D" ? CURVE_INFO["Type D"].color : "#fca5a5"}
                      strokeWidth={results.breakerCurve === "Type D" ? 3 : 1.5}
                      dot={false}
                      strokeDasharray={results.breakerCurve === "Type D" ? "0" : "4 2"}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Curve legends */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                {Object.entries(CURVE_INFO).map(([name, info]) => (
                  <div
                    key={name}
                    className={`p-3 rounded-xl border-2 transition-all ${results.breakerCurve === name ? 'shadow-md' : 'opacity-60'}`}
                    style={{ borderColor: info.color, backgroundColor: info.color + '12' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-1.5 rounded-full" style={{ backgroundColor: info.color }} />
                      <span className="text-xs font-bold" style={{ color: info.color }}>{name}</span>
                      {results.breakerCurve === name && (
                        <Badge className="text-white border-0 text-[9px] ml-auto" style={{ backgroundColor: info.color }}>Selected</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-tight">{info.desc}</p>
                    <p className="text-xs font-mono mt-1" style={{ color: info.color }}>{info.range}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
