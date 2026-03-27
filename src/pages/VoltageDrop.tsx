import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Calculator, Sparkles, TrendingDown, Zap } from "lucide-react";
import { ExportDialog } from "@/components/ExportDialog";
import { useSaveCalculation } from "@workspace/api-client-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';

export default function VoltageDrop() {
  const [voltage, setVoltage] = useState(230);
  const [current, setCurrent] = useState(10);
  const [length, setLength] = useState(50);
  const [size, setSize] = useState(2.5);
  const [material, setMaterial] = useState<"cu" | "al">("cu");

  const saveMutation = useSaveCalculation();

  const handleDemo = () => {
    setVoltage(230);
    setCurrent(15);
    setLength(100);
    setSize(4);
    setMaterial("cu");
  };

  const results = useMemo(() => {
    const rho = material === "cu" ? 0.0175 : 0.028;
    const vDrop = (2 * length * current * rho) / size;
    const vDropPercent = (vDrop / voltage) * 100;
    const finalVoltage = voltage - vDrop;
    
    let status = "OK";
    let statusColor = "text-green-500";
    if (vDropPercent > 5) {
      status = "FAIL (>5%)";
      statusColor = "text-red-500";
    } else if (vDropPercent > 3) {
      status = "WARNING (3-5%)";
      statusColor = "text-amber-500";
    }

    return {
      vDrop: vDrop.toFixed(2),
      vDropPercent: vDropPercent.toFixed(2),
      finalVoltage: finalVoltage.toFixed(2),
      status,
      statusColor
    };
  }, [voltage, current, length, size, material]);

  const chartData = useMemo(() => {
    const data = [];
    const rho = material === "cu" ? 0.0175 : 0.028;
    const step = Math.max(10, Math.round((length * 2) / 10));
    
    for (let l = 0; l <= length * 1.5; l += step) {
      const drop = (2 * l * current * rho) / size;
      const pct = (drop / voltage) * 100;
      data.push({
        distance: l,
        dropPercent: parseFloat(pct.toFixed(2))
      });
    }
    return data;
  }, [voltage, current, length, size, material]);

  const handleSaveHistory = (projectName: string, engineerName: string) => {
    saveMutation.mutate({
      data: {
        type: "voltage_drop",
        projectName,
        engineerName,
        inputs: JSON.stringify({ voltage, current, length, size, material }),
        results: JSON.stringify(results)
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <Zap className="w-6 h-6" />
            </div>
            Voltage Drop Calculator
          </h1>
          <p className="text-slate-500 mt-1">Calculate cable voltage drop for ELV & standard systems.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDemo} className="glass-card hover:bg-primary/5">
            <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
            Example Values
          </Button>
          <ExportDialog 
            data={{
              title: "Voltage Drop Calculation",
              inputs: { "Voltage (V)": voltage, "Current (A)": current, "Length (m)": length, "Size (mm²)": size, "Material": material.toUpperCase() },
              results: { "Voltage Drop (V)": results.vDrop, "Drop %": `${results.vDropPercent}%`, "Final Voltage (V)": results.finalVoltage, "Status": results.status },
              formula: "VD = (2 × L × I × ρ) / A"
            }}
            onSaveHistory={handleSaveHistory}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Form */}
        <Card className="lg:col-span-5 glass-card shadow-lg border-0">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 rounded-t-xl border-b border-border">
            <CardTitle className="text-lg">Input Parameters</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                System Voltage (V)
                <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground"/></TooltipTrigger><TooltipContent>Nominal supply voltage (e.g., 24V for fire alarm, 230V for mains)</TooltipContent></Tooltip>
              </Label>
              <Input type="number" value={voltage} onChange={e => setVoltage(Number(e.target.value) || 0)} className="bg-white/50" />
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Load Current (A)
                <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground"/></TooltipTrigger><TooltipContent>Total current drawn by the load</TooltipContent></Tooltip>
              </Label>
              <Input type="number" value={current} onChange={e => setCurrent(Number(e.target.value) || 0)} className="bg-white/50" />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Cable Length (m)
                <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground"/></TooltipTrigger><TooltipContent>One-way distance from source to load</TooltipContent></Tooltip>
              </Label>
              <Input type="number" value={length} onChange={e => setLength(Number(e.target.value) || 0)} className="bg-white/50" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cross-section (mm²)</Label>
                <Input type="number" value={size} onChange={e => setSize(Number(e.target.value) || 0)} className="bg-white/50" />
              </div>
              <div className="space-y-2">
                <Label>Material</Label>
                <Select value={material} onValueChange={(v: "cu"|"al") => setMaterial(v)}>
                  <SelectTrigger className="bg-white/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cu">Copper (Cu)</SelectItem>
                    <SelectItem value="al">Aluminum (Al)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results & Chart */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="glass-card shadow-xl border-0 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-primary" /> Results
                </h2>
                <div className={`px-4 py-1.5 rounded-full font-bold text-sm bg-white/50 dark:bg-black/20 shadow-sm border border-black/5 ${results.statusColor}`}>
                  {results.status}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                  <p className="text-sm text-slate-500 mb-1">Voltage Drop</p>
                  <p className="text-3xl font-display font-bold text-slate-900 dark:text-white">{results.vDrop} <span className="text-lg text-slate-400">V</span></p>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                  <div className={`absolute right-0 top-0 bottom-0 w-1 ${parseFloat(results.vDropPercent) > 5 ? 'bg-red-500' : 'bg-green-500'}`} />
                  <p className="text-sm text-slate-500 mb-1">Drop Percentage</p>
                  <p className={`text-3xl font-display font-bold ${results.statusColor}`}>{results.vDropPercent} <span className="text-lg">%</span></p>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                  <p className="text-sm text-slate-500 mb-1">Final Voltage</p>
                  <p className="text-3xl font-display font-bold text-slate-900 dark:text-white">{results.finalVoltage} <span className="text-lg text-slate-400">V</span></p>
                </div>
              </div>

              <div className="mt-8 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50">
                <p className="text-sm font-mono text-blue-800 dark:text-blue-300">
                  <strong>Formula:</strong> VD = (2 × L × I × ρ) / A<br/>
                  <span className="text-xs opacity-70">Where ρ = {material === 'cu' ? '0.0175 (Copper)' : '0.028 (Aluminum)'}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card shadow-lg border-0">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 rounded-t-xl border-b border-border py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-primary" /> Voltage Drop vs Distance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="distance" label={{ value: 'Distance (m)', position: 'insideBottomRight', offset: -10 }} tick={{fontSize: 12}} />
                    <YAxis label={{ value: 'Drop %', angle: -90, position: 'insideLeft' }} tick={{fontSize: 12}} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`${value}%`, 'Voltage Drop']}
                      labelFormatter={(label) => `Distance: ${label}m`}
                    />
                    <Line type="monotone" dataKey="dropPercent" stroke="#0ea5e9" strokeWidth={3} dot={{r: 4, fill: '#0ea5e9'}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
