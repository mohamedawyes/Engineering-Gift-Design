import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Flame, Battery, Cable, Plus, Trash2, Copy, ChevronDown, ChevronUp, 
  GitBranch, Printer, FileSpreadsheet, Save, AlertTriangle, CheckCircle2,
  AlertCircle, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { brands, Brand, Panel, Device } from "@/lib/fireAlarmData";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { saveToHistory } from "@/hooks/use-history";

// --- TYPES ---
interface LoopDevice {
  id: string;
  deviceId: string;
  customName?: string;
  customCurrentMA?: number;
  customAlarmCurrentMA?: number;
  quantity: number;
}

interface Loop {
  id: string;
  name: string;
  cableLength: number;
  cableSizeMM2: number;
  cableMaterial: "cu" | "al";
  devices: LoopDevice[];
  expanded: boolean;
}

interface ProjectInfo {
  name: string;
  engineer: string;
  client: string;
  date: string;
}

// --- HELPER FUNCTIONS ---
function createDefaultLoop(num: number): Loop {
  return { 
    id: crypto.randomUUID(), 
    name: `Loop ${num}`, 
    cableLength: 1000, 
    cableSizeMM2: 1.5, 
    cableMaterial: "cu", 
    devices: [],
    expanded: true
  };
}

const BATTERY_SIZES = [7, 12, 17, 24, 38, 65, 100];
function getRecommendedBattery(calcAh: number): number {
  return BATTERY_SIZES.find(size => size >= calcAh) || BATTERY_SIZES[BATTERY_SIZES.length - 1];
}

// --- MAIN COMPONENT ---
export default function FireAlarm() {
  const { toast } = useToast();
  
  // App State
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({ 
    name: "", engineer: "", client: "", date: new Date().toLocaleDateString() 
  });
  const [selectedBrandId, setSelectedBrandId] = useState(brands[0].id);
  const [selectedPanelId, setSelectedPanelId] = useState(brands[0].panels[0]?.id || "");
  const [loops, setLoops] = useState<Loop[]>([createDefaultLoop(1)]);
  const [standbyHours, setStandbyHours] = useState(24);
  const [alarmMinutes, setAlarmMinutes] = useState(30);
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const svgRef = useRef<SVGSVGElement>(null);

  // Derived Data
  const currentBrand = useMemo(() => brands.find(b => b.id === selectedBrandId) || brands[0], [selectedBrandId]);
  const currentPanel = useMemo(() => currentBrand.panels.find(p => p.id === selectedPanelId) || currentBrand.panels[0], [currentBrand, selectedPanelId]);

  // Calculations per Loop
  const loopCalculations = useMemo(() => {
    return loops.map(loop => {
      let standbyCurrentMA = 0;
      let alarmCurrentMA = 0;
      let totalDevices = 0;
      let detectorsCount = 0;
      let soundersCount = 0;
      let callpointsCount = 0;
      let modulesCount = 0;

      loop.devices.forEach(ld => {
        let current = 0;
        let alarm = 0;
        
        if (ld.deviceId === "custom") {
          current = ld.customCurrentMA || 0;
          alarm = ld.customAlarmCurrentMA || 0;
        } else {
          const device = currentBrand.devices.find(d => d.id === ld.deviceId);
          if (device) {
            current = device.currentMA;
            alarm = device.alarmCurrentMA;
            if (device.type === 'detector') detectorsCount += ld.quantity;
            if (device.type === 'sounder') soundersCount += ld.quantity;
            if (device.type === 'callpoint') callpointsCount += ld.quantity;
            if (device.type === 'module') modulesCount += ld.quantity;
          }
        }
        
        standbyCurrentMA += (current * ld.quantity);
        alarmCurrentMA += (alarm * ld.quantity);
        totalDevices += ld.quantity;
      });

      const rho = loop.cableMaterial === "cu" ? 0.0175 : 0.028;
      const loopResistance = (2 * loop.cableLength * rho) / loop.cableSizeMM2;
      const voltageDrop = (alarmCurrentMA / 1000) * loopResistance;
      const nominalVolt = currentPanel?.nominalVoltage || 24;
      const voltageDropPct = nominalVolt > 0 ? (voltageDrop / nominalVolt) * 100 : 0;
      const endVoltage = nominalVolt - voltageDrop;
      
      let status = "safe";
      if (voltageDropPct > 10) status = "danger";
      else if (voltageDropPct > 5) status = "warning";

      const maxDevicesReached = currentPanel && totalDevices >= currentPanel.maxDevicesPerLoop;

      return {
        ...loop,
        standbyCurrentMA,
        alarmCurrentMA,
        totalDevices,
        detectorsCount,
        soundersCount,
        callpointsCount,
        modulesCount,
        loopResistance,
        voltageDrop,
        voltageDropPct,
        endVoltage,
        status,
        maxDevicesReached
      };
    });
  }, [loops, currentBrand, currentPanel]);

  // System & Battery Calculations
  const systemCalculations = useMemo(() => {
    let totalStandbyMA = 80; // Panel quiescent baseline
    let totalAlarmMA = 500; // Panel alarm baseline (sounders, bells, relays)

    loopCalculations.forEach(calc => {
      totalStandbyMA += calc.standbyCurrentMA;
      totalAlarmMA += calc.alarmCurrentMA;
    });

    let batteryAh = (totalStandbyMA * standbyHours + totalAlarmMA * (alarmMinutes / 60)) / 1000;
    batteryAh *= 1.25; // 25% safety factor
    
    return {
      totalStandbyMA,
      totalAlarmMA,
      batteryAh,
      recommendedBattery: getRecommendedBattery(batteryAh)
    };
  }, [loopCalculations, standbyHours, alarmMinutes]);

  // Handlers
  const handleBrandChange = (brandId: string) => {
    setSelectedBrandId(brandId);
    const brand = brands.find(b => b.id === brandId);
    if (brand && brand.panels.length > 0) {
      setSelectedPanelId(brand.panels[0].id);
    } else {
      setSelectedPanelId("");
    }
  };

  const handleAddLoop = () => {
    if (!currentPanel || loops.length >= currentPanel.maxLoops) return;
    setLoops([...loops, createDefaultLoop(loops.length + 1)]);
  };

  const handleDeleteLoop = (id: string) => {
    if (loops.length <= 1) return;
    setLoops(loops.filter(l => l.id !== id));
  };

  const handleDuplicateLoop = (loopToClone: Loop) => {
    if (!currentPanel || loops.length >= currentPanel.maxLoops) {
      toast({ title: "Max Loops Reached", description: `Panel supports max ${currentPanel?.maxLoops || 0} loops.`, variant: "destructive" });
      return;
    }
    const newLoop = { 
      ...loopToClone, 
      id: crypto.randomUUID(), 
      name: `${loopToClone.name} (Copy)` 
    };
    setLoops([...loops, newLoop]);
  };

  const toggleLoopExpand = (id: string) => {
    setLoops(loops.map(l => l.id === id ? { ...l, expanded: !l.expanded } : l));
  };

  const handleUpdateLoop = (id: string, updates: Partial<Loop>) => {
    setLoops(loops.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const handleAddDevice = (loopId: string) => {
    const loop = loops.find(l => l.id === loopId);
    if (!loop) return;

    const calc = loopCalculations.find(c => c.id === loopId);
    if (currentPanel && calc && calc.totalDevices >= currentPanel.maxDevicesPerLoop) {
      toast({ title: "Warning", description: "Maximum devices per loop reached for this panel.", variant: "destructive" });
      return; // Still allow adding, but show warning
    }

    const newDevice: LoopDevice = {
      id: crypto.randomUUID(),
      deviceId: currentBrand.devices[0]?.id || "custom",
      quantity: 1,
    };
    handleUpdateLoop(loopId, { devices: [...loop.devices, newDevice] });
  };

  const handleUpdateDevice = (loopId: string, deviceId: string, updates: Partial<LoopDevice>) => {
    setLoops(loops.map(l => {
      if (l.id !== loopId) return l;
      return {
        ...l,
        devices: l.devices.map(d => d.id === deviceId ? { ...d, ...updates } : d)
      };
    }));
  };

  const handleDeleteDevice = (loopId: string, deviceId: string) => {
    setLoops(loops.map(l => {
      if (l.id !== loopId) return l;
      return { ...l, devices: l.devices.filter(d => d.id !== deviceId) };
    }));
  };

  const t = (en: string, ar: string) => language === "en" ? en : ar;

  // Print & History
  const handlePrint = () => window.print();

  const handleSaveHistory = () => {
    saveToHistory({
      module: "Fire Alarm LSN",
      projectName: projectInfo.name || undefined,
      inputs: {
        Brand: currentBrand?.name,
        Panel: currentPanel?.name,
        Loops: loops.length,
        "Standby (h)": standbyHours,
        "Alarm (min)": alarmMinutes,
      },
      results: {
        "Total Loops": loopCalculations.length,
        "Total Devices": loopCalculations.reduce((s, l) => s + l.totalDevices, 0),
        "Standby Current (mA)": systemCalculations.totalStandbyMA.toFixed(1),
        "Alarm Current (mA)": systemCalculations.totalAlarmMA.toFixed(1),
        "Battery Capacity (Ah)": systemCalculations.batteryAh.toFixed(2),
        "Recommended Battery": `${systemCalculations.recommendedBattery} Ah`,
      },
    });
    toast({ title: "Saved!", description: "Calculation saved to history." });
  };

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 0: Project Info
      const projData = [
        { Field: "Project Name", Value: projectInfo.name || 'N/A' },
        { Field: "Engineer", Value: projectInfo.engineer || 'N/A' },
        { Field: "Client", Value: projectInfo.client || 'N/A' },
        { Field: "Date", Value: projectInfo.date },
        { Field: "Brand", Value: currentBrand?.name || 'N/A' },
        { Field: "Panel Model", Value: currentPanel?.name || 'N/A' },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projData), "Project Info");
      
      // Sheet 1: Loops Summary
      const loopsData = loopCalculations.map(l => ({
        "Loop Name": l.name,
        "Cable Length (m)": l.cableLength,
        "Cable Size (mm²)": l.cableSizeMM2,
        "Material": l.cableMaterial.toUpperCase(),
        "Total Devices": l.totalDevices,
        "Standby mA": l.standbyCurrentMA.toFixed(2),
        "Alarm mA": l.alarmCurrentMA.toFixed(2),
        "Resistance (Ω)": l.loopResistance.toFixed(2),
        "Voltage Drop (V)": l.voltageDrop.toFixed(2),
        "Drop %": l.voltageDropPct.toFixed(2),
        "End Voltage (V)": l.endVoltage.toFixed(2),
        "Status": l.status.toUpperCase()
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(loopsData), "Loops Summary");

      // Sheet 2: Device Address List (SLD data)
      const deviceAddressRows: object[] = [];
      loopCalculations.forEach((loop, li) => {
        let addrSeq = 1;
        loop.devices.forEach(ld => {
          const devInfo = ld.deviceId === 'custom'
            ? { name: ld.customName || 'Custom', type: 'custom', currentMA: ld.customCurrentMA || 0, alarmCurrentMA: ld.customAlarmCurrentMA || 0 }
            : currentBrand.devices.find(d => d.id === ld.deviceId) || { name: 'Unknown', type: 'unknown', currentMA: 0, alarmCurrentMA: 0 };
          for (let q = 0; q < ld.quantity; q++) {
            deviceAddressRows.push({
              "Loop": loop.name,
              "Address": `L${li + 1}-${String(addrSeq).padStart(3, '0')}`,
              "Device Name": devInfo.name,
              "Type": devInfo.type.charAt(0).toUpperCase() + devInfo.type.slice(1),
              "Standby mA": devInfo.currentMA,
              "Alarm mA": devInfo.alarmCurrentMA,
            });
            addrSeq++;
          }
        });
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deviceAddressRows), "Device Addresses");
      
      // Sheet 3: Battery Calc
      const battData = [
        { Parameter: "System Standby Current (mA)", Value: systemCalculations.totalStandbyMA.toFixed(2) },
        { Parameter: "System Alarm Current (mA)", Value: systemCalculations.totalAlarmMA.toFixed(2) },
        { Parameter: "Standby Time (Hours)", Value: standbyHours },
        { Parameter: "Alarm Time (Minutes)", Value: alarmMinutes },
        { Parameter: "Calculated Capacity (Ah)", Value: systemCalculations.batteryAh.toFixed(2) },
        { Parameter: "Recommended Battery (Ah)", Value: systemCalculations.recommendedBattery }
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(battData), "Battery Calc");
      
      XLSX.writeFile(wb, `FireAlarm_Report_${projectInfo.name || 'Project'}.xlsx`);
      toast({ title: "Excel Exported", description: "4-sheet report with device addresses downloaded!" });
    } catch (e) {
      toast({ title: "Export Failed", description: "Failed to generate Excel.", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto pb-10" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* LEFT SIDEBAR - PROJECT & CONFIG */}
      <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
        <div className="sticky top-6 space-y-6">
          <Card className="glass-card border-0 shadow-lg overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-400" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Flame className="w-5 h-5 text-red-500" /> 
                  {t("Fire Alarm LSN", "إنذار الحريق LSN")}
                </CardTitle>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button onClick={() => setLanguage('en')} className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${language === 'en' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500'}`}>EN</button>
                  <button onClick={() => setLanguage('ar')} className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${language === 'ar' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500'}`}>AR</button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Input placeholder={t("Project Name", "اسم المشروع")} value={projectInfo.name} onChange={e => setProjectInfo({...projectInfo, name: e.target.value})} className="bg-white/50 dark:bg-black/20" />
                <Input placeholder={t("Engineer Name", "اسم المهندس")} value={projectInfo.engineer} onChange={e => setProjectInfo({...projectInfo, engineer: e.target.value})} className="bg-white/50 dark:bg-black/20" />
                <Input placeholder={t("Client Name", "اسم العميل")} value={projectInfo.client} onChange={e => setProjectInfo({...projectInfo, client: e.target.value})} className="bg-white/50 dark:bg-black/20" />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <div className="space-y-2">
                  <Label>{t("System Brand", "العلامة التجارية")}</Label>
                  <Select value={selectedBrandId} onValueChange={handleBrandChange}>
                    <SelectTrigger className="bg-white/50 dark:bg-black/20 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {currentBrand && currentBrand.panels.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t("Fire Panel Model", "لوحة الإنذار")}</Label>
                    <Select value={selectedPanelId} onValueChange={setSelectedPanelId}>
                      <SelectTrigger className="bg-white/50 dark:bg-black/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currentBrand.panels.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <Label className="flex items-center gap-2"><Battery className="w-4 h-4 text-emerald-500" /> {t("Battery Config", "إعدادات البطارية")}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">{t("Standby (Hours)", "زمن الاستعداد (ساعات)")}</Label>
                    <Input type="number" value={standbyHours} onChange={e => setStandbyHours(Number(e.target.value)||0)} className="bg-white/50 dark:bg-black/20" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">{t("Alarm (Minutes)", "زمن الإنذار (دقائق)")}</Label>
                    <Input type="number" value={alarmMinutes} onChange={e => setAlarmMinutes(Number(e.target.value)||0)} className="bg-white/50 dark:bg-black/20" />
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Quick Summary Card */}
          <Card className="glass-card border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t("Total Loops", "إجمالي الحلقات")}</span>
                <span className="font-bold">{loops.length} / {currentPanel?.maxLoops || 0}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t("Total Devices", "إجمالي الأجهزة")}</span>
                <span className="font-bold">{loopCalculations.reduce((acc, curr) => acc + curr.totalDevices, 0)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t("System Standby", "استهلاك الاستعداد")}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{systemCalculations.totalStandbyMA.toFixed(1)} mA</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* RIGHT PANEL - MAIN CONTENT */}
      <div className="flex-1 min-w-0">
        <Tabs defaultValue="loops" className="w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <TabsList className="glass p-1">
              <TabsTrigger value="loops" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-6">
                <Cable className="w-4 h-4 mr-2" /> {t("Loops", "الحلقات")}
              </TabsTrigger>
              <TabsTrigger value="battery" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-6">
                <Battery className="w-4 h-4 mr-2" /> {t("Battery", "البطارية")}
              </TabsTrigger>
              <TabsTrigger value="sld" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-6">
                <GitBranch className="w-4 h-4 mr-2" /> {t("Diagram", "مخطط الدائرة")}
              </TabsTrigger>
              <TabsTrigger value="export" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-6">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> {t("Export", "التصدير")}
              </TabsTrigger>
            </TabsList>
            
            <Button 
              onClick={handleAddLoop} 
              disabled={!currentPanel || loops.length >= currentPanel.maxLoops}
              className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 rounded-full px-6"
            >
              <Plus className="w-4 h-4 mr-2" /> {t("Add Loop", "إضافة حلقة")}
            </Button>
          </div>

          <TabsContent value="loops" className="space-y-4 focus-visible:outline-none">
            <AnimatePresence>
              {loopCalculations.map((loop, index) => (
                <motion.div
                  key={loop.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className={`glass-card border-0 shadow-md overflow-hidden relative ${
                    loop.status === 'danger' ? 'ring-1 ring-red-500/50' :
                    loop.status === 'warning' ? 'ring-1 ring-amber-500/50' : 'ring-1 ring-emerald-500/20'
                  }`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      loop.status === 'danger' ? 'bg-red-500' :
                      loop.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    
                    {/* Loop Header */}
                    <div className="p-4 pl-6 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => toggleLoopExpand(loop.id)}>
                      <div className="flex items-center gap-4 flex-1">
                        <Input 
                          value={loop.name} 
                          onChange={(e) => handleUpdateLoop(loop.id, { name: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-40 font-bold bg-transparent border-transparent hover:border-slate-200 focus:border-primary focus:bg-white dark:focus:bg-slate-900 transition-all px-2 h-8"
                        />
                        <div className="hidden md:flex items-center gap-2">
                          <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-xs">
                            <Cable className="w-3 h-3 mr-1" /> {loop.totalDevices} Dev
                          </Badge>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                            {loop.standbyCurrentMA.toFixed(1)} mA
                          </Badge>
                          <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800">
                            {loop.alarmCurrentMA.toFixed(1)} mA (Alarm)
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {loop.status === 'safe' && <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="w-3 h-3 mr-1"/> Safe: {loop.voltageDropPct.toFixed(1)}%</Badge>}
                        {loop.status === 'warning' && <Badge className="bg-amber-500 hover:bg-amber-600"><AlertTriangle className="w-3 h-3 mr-1"/> Warn: {loop.voltageDropPct.toFixed(1)}%</Badge>}
                        {loop.status === 'danger' && <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1"/> Danger: {loop.voltageDropPct.toFixed(1)}%</Badge>}
                        
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-primary" onClick={() => handleDuplicateLoop(loop)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Duplicate Loop</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-500" onClick={() => handleDeleteLoop(loop.id)} disabled={loops.length === 1}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Loop</TooltipContent>
                          </Tooltip>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            {loop.expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Loop Body */}
                    {loop.expanded && (
                      <div className="p-4 pl-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                        {/* Cable Params */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500 flex items-center gap-1">Cable Length (m) <Tooltip><TooltipTrigger><Info className="w-3 h-3"/></TooltipTrigger><TooltipContent>One-way length. Formula multiplies by 2 automatically.</TooltipContent></Tooltip></Label>
                            <Input type="number" value={loop.cableLength} onChange={e => handleUpdateLoop(loop.id, { cableLength: Number(e.target.value)||0 })} className="h-9" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500">Cross Section (mm²)</Label>
                            <Input type="number" value={loop.cableSizeMM2} onChange={e => handleUpdateLoop(loop.id, { cableSizeMM2: Number(e.target.value)||0 })} className="h-9" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500">Material</Label>
                            <Select value={loop.cableMaterial} onValueChange={(v: "cu"|"al") => handleUpdateLoop(loop.id, { cableMaterial: v })}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cu">Copper (Cu)</SelectItem>
                                <SelectItem value="al">Aluminum (Al)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Devices Table */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center px-1">
                            <Label className="font-semibold">{t("Devices on Loop", "الأجهزة على الحلقة")}</Label>
                            {loop.maxDevicesReached && <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-1 rounded">⚠️ Max Devices ({currentPanel?.maxDevicesPerLoop}) Reached</span>}
                          </div>
                          
                          <div className="space-y-2">
                            {loop.devices.map((device, idx) => (
                              <div key={device.id} className="flex flex-wrap md:flex-nowrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                <div className="flex-1 min-w-[200px]">
                                  <Select 
                                    value={device.deviceId} 
                                    onValueChange={(v) => handleUpdateDevice(loop.id, device.id, { deviceId: v })}
                                  >
                                    <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-900 border-0">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="custom" className="font-bold text-primary">-- Custom Device --</SelectItem>
                                      {currentBrand?.devices.map(d => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                {device.deviceId === "custom" && (
                                  <>
                                    <Input 
                                      placeholder="Name" 
                                      value={device.customName || ""} 
                                      onChange={(e) => handleUpdateDevice(loop.id, device.id, { customName: e.target.value })}
                                      className="h-9 w-32"
                                    />
                                    <div className="flex items-center gap-1 w-24">
                                      <Input 
                                        type="number" 
                                        placeholder="mA" 
                                        value={device.customCurrentMA || ""} 
                                        onChange={(e) => handleUpdateDevice(loop.id, device.id, { customCurrentMA: Number(e.target.value) })}
                                        className="h-9"
                                      />
                                    </div>
                                    <div className="flex items-center gap-1 w-24">
                                      <Input 
                                        type="number" 
                                        placeholder="Alarm mA" 
                                        value={device.customAlarmCurrentMA || ""} 
                                        onChange={(e) => handleUpdateDevice(loop.id, device.id, { customAlarmCurrentMA: Number(e.target.value) })}
                                        className="h-9"
                                      />
                                    </div>
                                  </>
                                )}
                                
                                <div className="flex items-center gap-2 w-24 ml-auto">
                                  <Label className="text-xs text-slate-500 md:hidden">Qty</Label>
                                  <Input 
                                    type="number" 
                                    min={1}
                                    value={device.quantity} 
                                    onChange={(e) => handleUpdateDevice(loop.id, device.id, { quantity: Number(e.target.value) || 1 })}
                                    className="h-9 font-bold text-center"
                                  />
                                </div>
                                
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDeleteDevice(loop.id, device.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            
                            <Button 
                              variant="outline" 
                              className="w-full border-dashed text-primary hover:bg-primary/5 hover:text-primary h-10 mt-2" 
                              onClick={() => handleAddDevice(loop.id)}
                            >
                              <Plus className="w-4 h-4 mr-2" /> Add Device
                            </Button>
                          </div>
                        </div>

                        {/* Loop Results Row */}
                        <div className="mt-6 bg-slate-900 dark:bg-black text-white rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 shadow-inner">
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Loop Resistance</p>
                            <p className="text-lg font-display font-semibold">{loop.loopResistance.toFixed(2)} Ω</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Voltage Drop</p>
                            <p className="text-lg font-display font-semibold">{loop.voltageDrop.toFixed(2)} V</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">End Voltage</p>
                            <p className="text-lg font-display font-semibold">{loop.endVoltage.toFixed(2)} V</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Max Devices</p>
                            <p className={`text-lg font-display font-semibold ${loop.maxDevicesReached ? 'text-red-400' : 'text-emerald-400'}`}>
                              {loop.totalDevices} / {currentPanel?.maxDevicesPerLoop || 0}
                            </p>
                          </div>
                        </div>

                      </div>
                    )}
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="battery">
            <Card className="glass-card shadow-xl border-0 overflow-hidden">
              <div className="h-3 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <CardContent className="p-8">
                <div className="text-center mb-10">
                  <div className="inline-flex p-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 mb-4 shadow-inner">
                    <Battery className="w-12 h-12" />
                  </div>
                  <h2 className="text-3xl font-display font-bold">{t("Battery Calculation", "حساب البطارية")}</h2>
                  <p className="text-slate-500 mt-2">{t("Calculated based on EN-54 standards with 25% safety margin.", "محسوب بناءً على معايير EN-54 مع هامش أمان 25٪.")}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                  <div className="space-y-6">
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Total Standby Current</p>
                        <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{systemCalculations.totalStandbyMA.toFixed(1)} <span className="text-sm font-normal">mA</span></p>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center font-bold">
                        {standbyHours}h
                      </div>
                    </div>
                    
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Total Alarm Current</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{systemCalculations.totalAlarmMA.toFixed(1)} <span className="text-sm font-normal">mA</span></p>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center font-bold">
                        {alarmMinutes}m
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
                    
                    <p className="text-slate-400 font-medium mb-2">Calculated Capacity</p>
                    <div className="flex items-baseline gap-2 mb-6">
                      <span className="text-5xl font-display font-bold">{systemCalculations.batteryAh.toFixed(2)}</span>
                      <span className="text-xl text-slate-400">Ah</span>
                    </div>

                    <div className="h-px w-full bg-white/10 my-4" />

                    <p className="text-emerald-400 font-medium mb-2">Recommended Standard Size</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-6xl font-display font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">{systemCalculations.recommendedBattery}</span>
                      <span className="text-2xl text-emerald-500">Ah</span>
                    </div>
                  </div>
                </div>

                <div className="max-w-4xl mx-auto mt-8 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-sm font-mono text-slate-600 dark:text-slate-400">
                    <span className="text-primary font-bold">Formula:</span> Ah = [(Standby_mA × {standbyHours}h) + (Alarm_mA × {alarmMinutes / 60}h)] / 1000 × 1.25
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sld">
            <Card className="glass-card shadow-xl border-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><GitBranch className="w-5 h-5 text-primary" /> {t("Single Line Diagram (SLD)", "مخطط الخط الواحد")}</CardTitle>
                    <CardDescription>{t("Every device shown with its individual loop address", "كل جهاز يظهر بعنوانه الخاص على الحلقة")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0 pb-6">
                {(() => {
                  const COL_W = 170;
                  const PANEL_W = 200;
                  const PANEL_H = 72;
                  const PANEL_Y = 24;
                  const BUS_Y = PANEL_Y + PANEL_H + 20;
                  const LOOP_BOX_H = 58;
                  const LOOP_Y = BUS_Y + 12;
                  const DEV_START_Y = LOOP_Y + LOOP_BOX_H + 24;
                  const DEV_H = 72;

                  // Expand each loop's devices into individual addressed units
                  const expandedLoops = loopCalculations.map((loop, li) => {
                    const devices: { addr: string; name: string; type: string; color: string }[] = [];
                    let seq = 1;
                    loop.devices.forEach(ld => {
                      const devInfo = ld.deviceId === 'custom'
                        ? { name: ld.customName || 'Device', type: 'custom' }
                        : (currentBrand.devices.find(d => d.id === ld.deviceId) || { name: 'Unknown', type: 'unknown' });
                      const color = devInfo.type === 'detector' ? '#3b82f6'
                        : devInfo.type === 'sounder' ? '#ef4444'
                        : devInfo.type === 'callpoint' ? '#f59e0b'
                        : devInfo.type === 'module' ? '#64748b'
                        : '#8b5cf6';
                      for (let q = 0; q < ld.quantity; q++) {
                        devices.push({
                          addr: `L${li + 1}-${String(seq).padStart(3, '0')}`,
                          name: devInfo.name.length > 14 ? devInfo.name.slice(0, 13) + '…' : devInfo.name,
                          type: devInfo.type,
                          color
                        });
                        seq++;
                      }
                    });
                    return { ...loop, expandedDevices: devices, loopIndex: li };
                  });

                  const maxDevices = Math.max(0, ...expandedLoops.map(l => l.expandedDevices.length));
                  const svgW = Math.max(860, expandedLoops.length * COL_W + 100);
                  const svgH = DEV_START_Y + maxDevices * DEV_H + 60;
                  const panelX = svgW / 2 - PANEL_W / 2;

                  // Center all loops under the panel so the trunk always connects
                  const totalBusWidth = Math.max(0, (expandedLoops.length - 1) * COL_W);
                  const busStartX = svgW / 2 - totalBusWidth / 2;
                  const loopXCenter = (li: number) => busStartX + li * COL_W;

                  return (
                    <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 m-4 overflow-x-auto">
                      <svg
                        ref={svgRef}
                        width={svgW}
                        height={svgH}
                        viewBox={`0 0 ${svgW} ${svgH}`}
                        className="font-sans"
                        style={{ minWidth: svgW }}
                      >
                        {/* ── Background ── */}
                        <rect width={svgW} height={svgH} fill="#ffffff" />

                        {/* ── PANEL BOX ── */}
                        <rect x={panelX} y={PANEL_Y} width={PANEL_W} height={PANEL_H} rx="10" fill="#0f172a" />
                        <rect x={panelX} y={PANEL_Y} width={PANEL_W} height={6} rx="3" fill="#3b82f6" />
                        <text x={svgW / 2} y={PANEL_Y + 28} textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">{currentBrand?.name || 'Fire Panel'}</text>
                        <text x={svgW / 2} y={PANEL_Y + 46} textAnchor="middle" fill="#94a3b8" fontSize="11">{currentPanel?.name || 'Panel Model'}</text>
                        <text x={svgW / 2} y={PANEL_Y + 63} textAnchor="middle" fill="#3b82f6" fontSize="10">{currentPanel?.nominalVoltage || 24}V DC  |  {loops.length} Loops  |  {currentPanel?.maxDevicesPerLoop} Dev/Loop</text>

                        {/* ── TRUNK LINE (panel → bus) ── */}
                        <line x1={svgW / 2} y1={PANEL_Y + PANEL_H} x2={svgW / 2} y2={BUS_Y} stroke="#3b82f6" strokeWidth="2.5" />

                        {/* ── HORIZONTAL BUS LINE ── */}
                        {expandedLoops.length > 0 && (
                          <line
                            x1={loopXCenter(0)}
                            y1={BUS_Y}
                            x2={loopXCenter(expandedLoops.length - 1)}
                            y2={BUS_Y}
                            stroke="#3b82f6"
                            strokeWidth="2.5"
                          />
                        )}

                        {/* ── PER LOOP ── */}
                        {expandedLoops.map((loop, li) => {
                          const cx = loopXCenter(li);
                          const loopColor = loop.status === 'danger' ? '#ef4444' : loop.status === 'warning' ? '#f59e0b' : '#10b981';
                          const LOOP_BOX_W = 140;
                          const lbx = cx - LOOP_BOX_W / 2;

                          return (
                            <g key={loop.id}>
                              {/* bus → loop vertical drop */}
                              <line x1={cx} y1={BUS_Y} x2={cx} y2={LOOP_Y} stroke="#3b82f6" strokeWidth="2" />

                              {/* Loop box */}
                              <rect x={lbx} y={LOOP_Y} width={LOOP_BOX_W} height={LOOP_BOX_H} rx="8" fill={loopColor} fillOpacity="0.08" stroke={loopColor} strokeWidth="2" />
                              <rect x={lbx} y={LOOP_Y} width={LOOP_BOX_W} height={20} rx="4" fill={loopColor} fillOpacity="0.85" />
                              <text x={cx} y={LOOP_Y + 14} textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">{loop.name}</text>
                              <text x={cx} y={LOOP_Y + 32} textAnchor="middle" fill={loopColor} fontSize="9" fontWeight="600">{loop.cableLength}m · {loop.cableSizeMM2}mm²</text>
                              <text x={cx} y={LOOP_Y + 47} textAnchor="middle" fill="#64748b" fontSize="9">{loop.voltageDropPct.toFixed(1)}% drop · {loop.endVoltage.toFixed(1)}V end</text>

                              {/* loop → first device line */}
                              {loop.expandedDevices.length > 0 && (
                                <line x1={cx} y1={LOOP_Y + LOOP_BOX_H} x2={cx} y2={DEV_START_Y} stroke={loopColor} strokeWidth="1.5" strokeDasharray="4,2" />
                              )}

                              {/* ── DEVICES ── */}
                              {loop.expandedDevices.map((dev, di) => {
                                const dy = DEV_START_Y + di * DEV_H;
                                const SYM = 14;
                                const symX = cx - SYM / 2;
                                const symY = dy + 8;

                                // Device symbol based on type
                                const symbol = (() => {
                                  if (dev.type === 'detector') return (
                                    <g>
                                      <circle cx={cx} cy={symY + SYM / 2} r={SYM / 2} fill="none" stroke={dev.color} strokeWidth="1.8" />
                                      <line x1={cx - SYM * 0.3} y1={symY + SYM / 2} x2={cx + SYM * 0.3} y2={symY + SYM / 2} stroke={dev.color} strokeWidth="1.5" />
                                      <line x1={cx} y1={symY + SYM * 0.2} x2={cx} y2={symY + SYM * 0.8} stroke={dev.color} strokeWidth="1.5" />
                                    </g>
                                  );
                                  if (dev.type === 'sounder') return (
                                    <g>
                                      <polygon points={`${cx},${symY} ${cx + SYM * 0.7},${symY + SYM * 0.5} ${cx},${symY + SYM}`} fill={dev.color} fillOpacity="0.2" stroke={dev.color} strokeWidth="1.5" />
                                      <line x1={cx + SYM * 0.4} y1={symY + SYM * 0.2} x2={cx + SYM * 0.75} y2={symY + SYM * 0.15} stroke={dev.color} strokeWidth="1.2" />
                                    </g>
                                  );
                                  if (dev.type === 'callpoint') return (
                                    <g>
                                      <rect x={symX} y={symY} width={SYM} height={SYM} rx="2" fill="none" stroke={dev.color} strokeWidth="1.8" />
                                      <line x1={symX} y1={symY} x2={symX + SYM} y2={symY + SYM} stroke={dev.color} strokeWidth="1.2" />
                                    </g>
                                  );
                                  // module / custom / unknown → rectangle with dots
                                  return (
                                    <g>
                                      <rect x={symX - 2} y={symY} width={SYM + 4} height={SYM} rx="2" fill="none" stroke={dev.color} strokeWidth="1.8" />
                                      <circle cx={cx - 3} cy={symY + SYM / 2} r="1.5" fill={dev.color} />
                                      <circle cx={cx + 3} cy={symY + SYM / 2} r="1.5" fill={dev.color} />
                                    </g>
                                  );
                                })();

                                return (
                                  <g key={dev.addr}>
                                    {/* connector line */}
                                    <line x1={cx} y1={dy} x2={cx} y2={dy + 8} stroke={loopColor} strokeWidth="1.5" strokeDasharray="4,2" />

                                    {/* White device card */}
                                    <rect x={cx - 58} y={dy + 6} width={116} height={DEV_H - 14} rx="6" fill="#f8fafc" stroke={dev.color} strokeWidth="1.2" />

                                    {/* Symbol */}
                                    {symbol}

                                    {/* Address badge */}
                                    <rect x={cx - 56} y={dy + 9} width={38} height={14} rx="3" fill={dev.color} fillOpacity="0.12" />
                                    <text x={cx - 37} y={dy + 20} textAnchor="middle" fill={dev.color} fontSize="9" fontWeight="bold">{dev.addr}</text>

                                    {/* Device name */}
                                    <text x={cx} y={dy + 40} textAnchor="middle" fill="#1e293b" fontSize="9.5" fontWeight="600">{dev.name}</text>

                                    {/* Type label */}
                                    <text x={cx} y={dy + 52} textAnchor="middle" fill="#94a3b8" fontSize="8">{dev.type.charAt(0).toUpperCase() + dev.type.slice(1)}</text>

                                    {/* bottom connector */}
                                    {di < loop.expandedDevices.length - 1 && (
                                      <line x1={cx} y1={dy + DEV_H - 14} x2={cx} y2={dy + DEV_H} stroke={loopColor} strokeWidth="1.5" strokeDasharray="4,2" />
                                    )}
                                  </g>
                                );
                              })}
                            </g>
                          );
                        })}

                        {/* ── LEGEND ── */}
                        {[
                          { color: '#3b82f6', label: 'Detector' },
                          { color: '#ef4444', label: 'Sounder' },
                          { color: '#f59e0b', label: 'Call Point' },
                          { color: '#64748b', label: 'Module' },
                        ].map((item, idx) => (
                          <g key={idx} transform={`translate(${16 + idx * 105}, ${svgH - 24})`}>
                            <rect width="10" height="10" rx="2" fill={item.color} fillOpacity="0.25" stroke={item.color} strokeWidth="1.5" />
                            <text x="14" y="9" fill="#64748b" fontSize="9">{item.label}</text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="export">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <Card className="glass-card border-0 shadow hover:shadow-xl transition-all hover:-translate-y-1 group cursor-pointer" onClick={handlePrint}>
                <CardContent className="p-8 text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Printer className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold font-display">Print Report</h3>
                  <p className="text-slate-500 text-sm">Opens the browser print dialog with a clean, full-page report layout including SLD diagram.</p>
                  <Button className="w-full mt-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm">Print / Save as PDF</Button>
                </CardContent>
              </Card>

              <Card className="glass-card border-0 shadow hover:shadow-xl transition-all hover:-translate-y-1 group cursor-pointer" onClick={handleExportExcel}>
                <CardContent className="p-8 text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold font-display">Export Excel</h3>
                  <p className="text-slate-500 text-sm">Download raw data into a multi-sheet XLSX file for further processing or archiving.</p>
                  <Button className="w-full mt-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-sm">Download Excel</Button>
                </CardContent>
              </Card>

              <Card className="glass-card border-0 shadow hover:shadow-xl transition-all hover:-translate-y-1 group cursor-pointer" onClick={handleSaveHistory}>
                <CardContent className="p-8 text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Save className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold font-display">Save to History</h3>
                  <p className="text-slate-500 text-sm">Save this calculation to your local browser history for future reference or comparison.</p>
                  <Button className="w-full mt-2 bg-violet-500 hover:bg-violet-600 text-white rounded-full text-sm">Save Calculation</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
