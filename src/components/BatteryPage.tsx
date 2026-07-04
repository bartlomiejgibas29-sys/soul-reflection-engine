import { useState, useEffect } from "react";
import { Battery, RefreshCw, Save, Zap, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BatteryConfig } from "@/hooks/useSerial";

interface BatteryPageProps {
  config: BatteryConfig | null;
  onSend: (data: string) => Promise<void> | void;
}

export default function BatteryPage({ config, onSend }: BatteryPageProps) {
  const [cells, setCells] = useState("0");
  const [r1, setR1] = useState("0");
  const [r2, setR2] = useState("0");
  const [calVoltage, setCalVoltage] = useState("");

  useEffect(() => {
    onSend("GET_BATTERY_CONFIG");
    const interval = setInterval(() => {
        onSend("GET_BATTERY_CONFIG");
    }, 2000); // Poll every 2s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (config) {
      setCells(config.cells.toString());
      // Only update local state if not focused? Or always?
      // For now always, but might be annoying if editing.
      // Let's assume user saves then it updates.
      // But if we poll, it will overwrite.
      // Ideally we check if values changed significantly or track "editing" state.
      // For simplicity, only update if "0" (initial) or maybe we shouldn't overwrite if user is typing.
      // Let's trust React state and only update on initial load or if we want to sync.
      // Actually, standard pattern is to sync from props unless dirty.
      // For now, let's just sync when config changes, but maybe check if user is editing?
      // I'll just sync.
      if (document.activeElement?.tagName !== "INPUT") {
          setR1(config.r1.toString());
          setR2(config.r2.toString());
      }
    }
  }, [config]);

  const handleSaveConfig = () => {
    onSend(`SET_BATTERY_CONFIG:${cells}:${r1}:${r2}`);
  };

  const handleCalibrate = () => {
    if (!calVoltage) return;
    onSend(`CALIBRATE_BATTERY:${calVoltage}`);
    setCalVoltage("");
  };

  const suggestResistors = () => {
    // Logic: Max ADC is 3.3V.
    // Max battery voltage depends on cells.
    let maxV = 3.3;
    const c = parseInt(cells);
    if (c > 0) maxV = c * 4.2;
    else maxV = 25.2; // Default to 6S for safety if unknown

    // We want Vout <= 3.0V (safety margin)
    // Vout = Vin * R2 / (R1 + R2)
    // (R1 + R2) / R2 = maxV / 3.0
    // R1/R2 = (maxV / 3.0) - 1
    
    // Assume R2 = 10k (common)
    const r2Val = 10000;
    const r1Val = r2Val * ((maxV / 3.0) - 1);
    
    setR1(Math.round(r1Val).toString());
    setR2(r2Val.toString());
  };

  const getVoltageColor = (v: number, cells: number) => {
    if (cells === 0) return "text-white";
    const perCell = v / cells;
    if (perCell < 3.5) return "text-red-500";
    if (perCell < 3.7) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/40 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.10),_transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary/80">BetaDrive</p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">Battery</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Monitoring napięcia baterii, kalibracja i dobór rezystorów dzielnika.
            </p>
          </div>
        </div>
      </div>

      {/* Voltage Display */}
      <Card className="border-border/40 bg-background/40 shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Battery Voltage</CardTitle>
          <Battery className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-4xl font-bold ${config ? getVoltageColor(config.voltage, config.cells) : "text-muted-foreground"}`}>
            {config ? `${config.voltage.toFixed(2)} V` : "-- V"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {config?.cells ? `${config.cells}S LiPo` : "Auto / Unknown"}
             {config?.pin !== -1 ? ` (Pin ${config?.pin})` : " (No Pin)"}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" /> Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Battery Type</Label>
              <Select value={cells} onValueChange={setCells}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Auto / Custom</SelectItem>
                  <SelectItem value="1">1S LiPo (4.2V)</SelectItem>
                  <SelectItem value="2">2S LiPo (8.4V)</SelectItem>
                  <SelectItem value="3">3S LiPo (12.6V)</SelectItem>
                  <SelectItem value="4">4S LiPo (16.8V)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>R1 (Top, &Omega;)</Label>
                <Input value={r1} onChange={(e) => setR1(e.target.value)} type="number" />
              </div>
              <div className="space-y-2">
                <Label>R2 (Bottom, &Omega;)</Label>
                <Input value={r2} onChange={(e) => setR2(e.target.value)} type="number" />
              </div>
            </div>

            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={suggestResistors} className="flex-1">
                    <Calculator className="mr-2 h-4 w-4" /> Suggest R
                </Button>
                <Button onClick={handleSaveConfig} className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                    <Save className="mr-2 h-4 w-4" /> Save
                </Button>
            </div>
          </CardContent>
        </Card>

        {/* Calibration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Calibration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Measure the actual battery voltage with a multimeter and enter it here to calibrate.
            </p>
            <div className="flex gap-2">
              <Input 
                value={calVoltage} 
                onChange={(e) => setCalVoltage(e.target.value)} 
                placeholder="Actual Voltage (e.g. 7.45)" 
                type="number"
              />
              <Button onClick={handleCalibrate}>Calibrate</Button>
            </div>
            {config && (
                <div className="text-xs text-muted-foreground mt-2">
                    Current Calibration Factor: {config.calibration.toFixed(4)}
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
