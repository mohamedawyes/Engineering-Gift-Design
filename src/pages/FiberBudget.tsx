import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Calculator, Sparkles, Wifi } from "lucide-react";
import { ExportDialog } from "@/components/ExportDialog";
import { useSaveCalculation } from "@workspace/api-client-react";

export default function FiberBudget() {
  const [txPower, setTxPower] = useState(0);
  const [length, setLength] = useState(10);
  const [attenuation, setAttenuation] = useState(0.2); // per km
  const [connLoss, setConnLoss] = useState(0.5);
  const [numConn, setNumConn] = useState(4);
  const [spliceLoss, setSpliceLoss] = useState(0.1);
  const [numSplice, setNumSplice] = useState(2);
  const [rxSens, setRxSens] = useState(-20);

  const saveMutation = useSaveCalculation();

  const handleDemo = () => {
    setTxPower(2);
    setLength(15);
    setAttenuation(0.25);
    setConnLoss(0.5);
    setNumConn(4);
    setSpliceLoss(0.1);
    setNumSplice(4);
    setRxSens(-22);
  };

  const results = useMemo(() => {
    const fiberLoss = length * attenuation;
    const connectorLossTotal = numConn * connLoss;
    const spliceLossTotal = numSplice * spliceLoss;
    
    const totalLoss = fiberLoss + connectorLossTotal + spliceLossTotal;
    const receivedPower = txPower - totalLoss;
    const margin = receivedPower - rxSens;
    
    const status = margin >= 3 ? "OK (Healthy Margin)" : margin >= 0 ? "WARNING (Low Margin)" : "FAIL (No Link)";
    const statusColor = margin >= 3 ? "text-green-500" : margin >= 0 ? "text-amber-500" : "text-red-500";

    return {
      totalLoss: totalLoss.toFixed(2),
      receivedPower: receivedPower.toFixed(2),
      margin: margin.toFixed(2),
      status,
      statusColor
    };
  }, [txPower, length, attenuation, connLoss, numConn, spliceLoss, numSplice, rxSens]);

  const handleSaveHistory = (projectName: string, engineerName: string) => {
    saveMutation.mutate({
      data: {
        type: "fiber_budget",
        projectName,
        engineerName,
        inputs: JSON.stringify({ txPower, length, attenuation, connLoss, numConn, spliceLoss, numSplice, rxSens }),
        results: JSON.stringify(results)
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
              <Wifi className="w-6 h-6" />
            </div>
            Fiber Link Budget
          </h1>
          <p className="text-slate-500 mt-1">Calculate optical power budget for fiber links.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDemo} className="glass-card hover:bg-primary/5">
            <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
            Example Values
          </Button>
          <ExportDialog 
            data={{
              title: "Fiber Link Budget",
              inputs: { "Tx Power (dBm)": txPower, "Length (km)": length, "Atten (dB/km)": attenuation, "Conn Loss (dB)": connLoss, "Connectors": numConn, "Splice Loss": spliceLoss, "Splices": numSplice, "Rx Sens (dBm)": rxSens },
              results: { "Total Loss (dB)": results.totalLoss, "Rx Power (dBm)": results.receivedPower, "Margin (dB)": results.margin, "Status": results.status },
              formula: "Total Loss = (L×α) + (C×Lc) + (S×Ls)\nRx Power = Tx - Total Loss"
            }}
            onSaveHistory={handleSaveHistory}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-6 glass-card shadow-lg border-0">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 rounded-t-xl border-b border-border">
            <CardTitle className="text-lg">Network Parameters</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">Tx Power (dBm) <Tooltip><TooltipTrigger><Info className="w-3 h-3 text-muted-foreground"/></TooltipTrigger><TooltipContent>Transmitter output power</TooltipContent></Tooltip></Label>
                <Input type="number" value={txPower} onChange={e => setTxPower(Number(e.target.value) || 0)} className="bg-white/50" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">Rx Sensitivity (dBm) <Tooltip><TooltipTrigger><Info className="w-3 h-3 text-muted-foreground"/></TooltipTrigger><TooltipContent>Minimum required power at receiver</TooltipContent></Tooltip></Label>
                <Input type="number" value={rxSens} onChange={e => setRxSens(Number(e.target.value) || 0)} className="bg-white/50" />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border/50">
              <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wider">Fiber Characteristics</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Length (km)</Label>
                  <Input type="number" value={length} onChange={e => setLength(Number(e.target.value) || 0)} className="bg-white/50" />
                </div>
                <div className="space-y-2">
                  <Label>Attenuation (dB/km)</Label>
                  <Input type="number" step="0.01" value={attenuation} onChange={e => setAttenuation(Number(e.target.value) || 0)} className="bg-white/50" />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border/50">
              <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wider">Connections & Splices</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Num Connectors</Label>
                  <Input type="number" value={numConn} onChange={e => setNumConn(Number(e.target.value) || 0)} className="bg-white/50" />
                </div>
                <div className="space-y-2">
                  <Label>Loss per Connector (dB)</Label>
                  <Input type="number" step="0.1" value={connLoss} onChange={e => setConnLoss(Number(e.target.value) || 0)} className="bg-white/50" />
                </div>
                <div className="space-y-2">
                  <Label>Num Splices</Label>
                  <Input type="number" value={numSplice} onChange={e => setNumSplice(Number(e.target.value) || 0)} className="bg-white/50" />
                </div>
                <div className="space-y-2">
                  <Label>Loss per Splice (dB)</Label>
                  <Input type="number" step="0.1" value={spliceLoss} onChange={e => setSpliceLoss(Number(e.target.value) || 0)} className="bg-white/50" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-6 space-y-6">
          <Card className="glass-card shadow-xl border-0 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-purple-500" /> Budget Results
                </h2>
                <div className={`px-4 py-1.5 rounded-full font-bold text-sm bg-white/50 dark:bg-black/20 shadow-sm border border-black/5 ${results.statusColor}`}>
                  {results.status}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                  <p className="text-sm text-slate-500 mb-1">Total Loss</p>
                  <p className="text-4xl font-display font-bold text-slate-900 dark:text-white">{results.totalLoss} <span className="text-lg text-slate-400">dB</span></p>
                </div>
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                  <p className="text-sm text-slate-500 mb-1">Received Power</p>
                  <p className="text-4xl font-display font-bold text-slate-900 dark:text-white">{results.receivedPower} <span className="text-lg text-slate-400">dBm</span></p>
                </div>
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 md:col-span-2 relative overflow-hidden">
                  <div className={`absolute right-0 top-0 bottom-0 w-2 ${parseFloat(results.margin) >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                  <p className="text-sm text-slate-500 mb-1">Link Margin</p>
                  <p className={`text-5xl font-display font-bold ${results.statusColor}`}>{results.margin} <span className="text-2xl opacity-50">dB</span></p>
                  <p className="text-xs text-slate-400 mt-2">Margin = Rx Power - Rx Sensitivity. Target is &gt; 3dB.</p>
                </div>
              </div>

              <div className="mt-8 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/50">
                <p className="text-sm font-mono text-purple-800 dark:text-purple-300">
                  <strong>Formulas:</strong><br/>
                  Total Loss = (L×α) + (C×Lc) + (S×Ls)<br/>
                  Rx Power = Tx Power - Total Loss<br/>
                  Margin = Rx Power - Rx Sensitivity
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
