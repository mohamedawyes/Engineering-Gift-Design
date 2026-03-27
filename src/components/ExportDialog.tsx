import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { exportToPDF, exportToExcel, ExportData } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";

interface ExportDialogProps {
  data: Omit<ExportData, "projectName" | "engineerName">;
  onSaveHistory?: (projectName: string, engineerName: string) => void;
}

export function ExportDialog({ data, onSaveHistory }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [engineerName, setEngineerName] = useState("");
  const [isExporting, setIsExporting] = useState<"pdf" | "excel" | "history" | null>(null);
  const { toast } = useToast();

  const handleExport = async (type: "pdf" | "excel" | "history") => {
    setIsExporting(type);
    
    // Artificial delay for better UX
    await new Promise(r => setTimeout(r, 800));

    try {
      if (type === "history" && onSaveHistory) {
        onSaveHistory(projectName, engineerName);
        toast({ title: "Saved to History", description: "Calculation saved successfully." });
      } else {
        const exportData = {
          ...data,
          projectName,
          engineerName
        };

        if (type === "pdf") {
          exportToPDF(exportData);
          toast({ title: "Export Successful", description: "PDF report downloaded." });
        } else if (type === "excel") {
          exportToExcel(exportData);
          toast({ title: "Export Successful", description: "Excel report downloaded." });
        }
      }
      setOpen(false);
    } catch (error) {
      toast({ 
        title: "Export Failed", 
        description: "An error occurred while exporting.", 
        variant: "destructive" 
      });
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 glass-card hover:bg-white/50 dark:hover:bg-slate-800/50">
          <Download className="w-4 h-4" />
          <span>Export / Save</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] glass rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Export Report</DialogTitle>
          <DialogDescription>
            Add optional project details for your professional report or history log.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="project">Project Name</Label>
            <Input
              id="project"
              placeholder="e.g. Metro Station Phase 2"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="bg-white/50 dark:bg-black/20 focus:ring-primary/20"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="engineer">Engineer Name</Label>
            <Input
              id="engineer"
              placeholder="e.g. Ahmed Ali"
              value={engineerName}
              onChange={(e) => setEngineerName(e.target.value)}
              className="bg-white/50 dark:bg-black/20 focus:ring-primary/20"
            />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onSaveHistory && (
            <Button 
              variant="secondary" 
              onClick={() => handleExport("history")}
              disabled={!!isExporting}
              className="w-full sm:w-auto"
            >
              {isExporting === "history" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save to History
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => handleExport("excel")}
            disabled={!!isExporting}
            className="w-full sm:w-auto gap-2"
          >
            {isExporting === "excel" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
            )}
            Excel
          </Button>
          <Button 
            onClick={() => handleExport("pdf")}
            disabled={!!isExporting}
            className="w-full sm:w-auto gap-2 bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90"
          >
            {isExporting === "pdf" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            PDF Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
