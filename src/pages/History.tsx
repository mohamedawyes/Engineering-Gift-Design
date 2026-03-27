import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Trash2, Calendar, FileText, AlertTriangle } from "lucide-react";
import { useHistory } from "@/hooks/use-history";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

const MODULE_COLORS: Record<string, string> = {
  "Fire Alarm LSN": "from-red-500 to-orange-400",
  "CCTV Calculator": "from-violet-500 to-purple-500",
  "Telephone System": "from-teal-500 to-emerald-400",
  "Voltage Drop": "from-blue-500 to-cyan-400",
  "Fiber Budget": "from-indigo-500 to-purple-500",
  "Inrush Current": "from-orange-500 to-amber-400",
  "PA System": "from-pink-500 to-rose-400",
};

export default function History() {
  const { entries, removeEntry, clearAll } = useHistory();
  const { toast } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);

  const handleDelete = (id: string) => {
    removeEntry(id);
    toast({ title: "Deleted", description: "History record removed." });
  };

  const handleClearAll = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    clearAll();
    setConfirmClear(false);
    toast({ title: "Cleared", description: "All history deleted." });
  };

  const handleExportExcel = (entry: ReturnType<typeof useHistory>["entries"][number]) => {
    const wb = XLSX.utils.book_new();
    const infoRows = [
      ["Module", entry.module],
      ["Date", new Date(entry.date).toLocaleString()],
      ...(entry.projectName ? [["Project", entry.projectName]] : []),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(infoRows), "Info");
    const inputRows = Object.entries(entry.inputs).map(([k, v]) => [k, String(v)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Input", "Value"], ...inputRows]), "Inputs");
    const resultRows = Object.entries(entry.results).map(([k, v]) => [k, String(v)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Result", "Value"], ...resultRows]), "Results");
    XLSX.writeFile(wb, `${entry.module.replace(/\s/g, "_")}_${entry.id.slice(0, 6)}.xlsx`);
  };

  return (
    <div className="space-y-6 no-print">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300">
              <BookOpen className="w-6 h-6" />
            </div>
            Calculation History
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Saved locally in your browser. {entries.length} record{entries.length !== 1 ? "s" : ""}.</p>
        </div>
        {entries.length > 0 && (
          <Button
            variant={confirmClear ? "destructive" : "outline"}
            size="sm"
            onClick={handleClearAll}
            onBlur={() => setConfirmClear(false)}
            className="flex-shrink-0"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            {confirmClear ? "Confirm Clear All?" : "Clear All"}
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="py-24 text-center glass-card rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">No history yet</h3>
          <p className="text-slate-500 mt-2 text-sm">Use any calculator and click "Save to History" to store results here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {entries.map((entry) => {
            const gradient = MODULE_COLORS[entry.module] || "from-slate-500 to-slate-400";
            return (
              <Card key={entry.id} className="glass-card shadow border border-slate-200/50 dark:border-white/5 hover:shadow-xl transition-all group overflow-hidden">
                <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />
                <CardHeader className="pb-2 flex flex-row items-start justify-between pt-4">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">{entry.module}</CardTitle>
                    {entry.projectName && (
                      <p className="text-xs font-medium text-primary mt-0.5">{entry.projectName}</p>
                    )}
                    <CardDescription className="flex items-center gap-1 mt-1 text-xs">
                      <Calendar className="w-3 h-3" />
                      {new Date(entry.date).toLocaleString()}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(entry.id)}
                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 h-7 w-7 -mt-1 -mr-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800 mb-3">
                    <p className="font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1 mb-1.5">Key Results</p>
                    {Object.entries(entry.results).slice(0, 4).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-slate-500 truncate flex-1">{k}:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-right flex-shrink-0">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={() => handleExportExcel(entry)}
                  >
                    Export Excel
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
