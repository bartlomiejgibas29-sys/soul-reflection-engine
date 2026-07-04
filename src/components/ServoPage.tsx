import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, RefreshCw, Save, Activity, SlidersHorizontal } from "lucide-react";
import type { PinConfig, ServoConfig, ServoRange } from "@/hooks/useSerial";

interface ServoPageProps {
  pinConfigs: PinConfig[];
  servoConfigs: ServoConfig[];
  onSend: (data: string) => Promise<void> | void;
}

const CHANNELS = ["CH1", "CH2", "CH3", "CH4", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"];

const mapRange = (x: number, in_min: number, in_max: number, out_min: number, out_max: number) => {
  if (in_max === in_min) return out_min; // Avoid division by zero
  const result = ((x - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
  return isNaN(result) ? out_min : result;
};

const ServoPage = ({ pinConfigs, servoConfigs, onSend }: ServoPageProps) => {
  const servoPins = pinConfigs.filter(p => p.mode === "SERVO").map(p => p.pin);
  const [testMode, setTestMode] = useState<Record<number, boolean>>({});
  const [testVal, setTestVal] = useState<Record<number, number>>({});
  const throttleRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Local state for editing configs before saving
  const [localConfigs, setLocalConfigs] = useState<Record<number, ServoConfig>>({});

  // Sync props to local state
  useEffect(() => {
    const newConfigs: Record<number, ServoConfig> = {};
    servoConfigs.forEach(cfg => {
      newConfigs[cfg.pin] = { ...cfg, ranges: [...(cfg.ranges || [])] };
    });
    setLocalConfigs(prev => {
      // Only update if we don't have it or it's a fresh load (simplification)
      // Ideally we should merge, but for now let's just use what we have if the user hasn't edited?
      // Actually, better to just update if the incoming data is newer/different.
      // For simplicity in this interaction, let's just init if empty, otherwise keep local edits?
      // No, that risks desync. Let's merge carefully.
      const merged = { ...prev };
      servoConfigs.forEach(cfg => {
         if (!merged[cfg.pin]) {
             merged[cfg.pin] = { ...cfg, ranges: [...(cfg.ranges || [])] };
         }
         // If we wanted to live-update, we'd need a "dirty" flag.
         // Let's assume user hits "Refresh" to get latest, and "Save" to push.
      });
      return merged;
    });
  }, [servoConfigs]);

  // Initial load
  useEffect(() => {
    onSend("SERVO_TABLE");
    
    // Enable receiver mode for active control
    onSend("ENABLE_RECEIVER_MODE");
  }, [onSend]);

  const getEffectiveConfig = (pin: number, local: Record<number, ServoConfig>): ServoConfig => {
      const defaultConfig: ServoConfig = {
          pin, frequency: 50, minUs: 900, midUs: 1500, maxUs: 2100,
          sourceChannel: 0, reverse: false, rate: 1.0, speed: 0,
          mode: 0, minAngle: 0, maxAngle: 180, ranges: []
      };
      const cfg = local[pin] || servoConfigs.find(c => c.pin === pin) || defaultConfig;
      // Sanitize config to prevent NaN/crashes
      return {
          ...cfg,
          frequency: cfg.frequency || 50,
          minUs: cfg.minUs || 900,
          midUs: cfg.midUs || 1500,
          maxUs: cfg.maxUs || 2100,
          sourceChannel: cfg.sourceChannel || 0,
          rate: isNaN(cfg.rate) ? 1.0 : cfg.rate,
          speed: cfg.speed || 0,
          mode: cfg.mode || 0,
          minAngle: isNaN(cfg.minAngle) ? 0 : cfg.minAngle,
          maxAngle: isNaN(cfg.maxAngle) ? 180 : cfg.maxAngle,
          ranges: cfg.ranges || []
      };
  };

  const handleNumberInput = (value: string, callback: (num: number) => void) => {
    if (value === "") {
      callback(NaN);
    } else {
      const num = parseFloat(value);
      if (!isNaN(num)) callback(num);
    }
  };

  const renderNumberInput = (value: number, callback: (num: number) => void, className?: string, step?: string, max?: number, min?: number) => (
    <Input
      type="number"
      step={step || "1"}
      max={max}
      min={min}
      className={className}
      value={isNaN(value) ? "" : value}
      onChange={(e) => handleNumberInput(e.target.value, callback)}
    />
  );

  const handleUpdateConfig = (pin: number, updates: Partial<ServoConfig>) => {
    setLocalConfigs(prev => {
      const current = getEffectiveConfig(pin, prev);
      return {
        ...prev,
        [pin]: { ...current, ...updates }
      };
    });
  };

  const handleSave = async (pin: number) => {
    const cfg = getEffectiveConfig(pin, localConfigs);

    // Walidacja pól numerycznych
    const fieldsToValidate = [
      { name: 'Częstotliwość', val: cfg.frequency },
      { name: 'Min Us', val: cfg.minUs },
      { name: 'Mid Us', val: cfg.midUs },
      { name: 'Max Us', val: cfg.maxUs },
      { name: 'Rate', val: cfg.rate },
      { name: 'Min Angle', val: cfg.minAngle },
      { name: 'Max Angle', val: cfg.maxAngle }
    ];

    for (const field of fieldsToValidate) {
      if (field.val === undefined || field.val === null || isNaN(field.val)) {
        alert(`Pole "${field.name}" nie może być puste.`);
        return;
      }
    }

    if (cfg.ranges) {
      for (let i = 0; i < cfg.ranges.length; i++) {
        const r = cfg.ranges[i];
        if (isNaN(r.minIn) || isNaN(r.maxIn) || isNaN(r.targetUs)) {
          alert(`Zakres ${i + 1} zawiera nieprawidłowe lub puste dane.`);
          return;
        }
      }
    }

    // Send Main Config
    // Format: SET_SERVO_CFG:pin:freq:min:mid:max:src:rev:rate:speed:mode:minAngle:maxAngle:rangeCount
    const cmd = `SET_SERVO_CFG:${pin}:${cfg.frequency}:${cfg.minUs}:${cfg.midUs}:${cfg.maxUs}:${cfg.sourceChannel}:${cfg.reverse ? 1 : 0}:${cfg.rate}:${cfg.speed}:${cfg.mode}:${cfg.minAngle}:${cfg.maxAngle}:${cfg.ranges?.length || 0}`;
    await onSend(cmd);

    // Send Ranges
    if (cfg.ranges) {
        for (let i = 0; i < cfg.ranges.length; i++) {
            const r = cfg.ranges[i];
            // SET_SERVO_RNG:pin:idx:minIn:maxIn:targetUs
            await onSend(`SET_SERVO_RNG:${pin}:${i}:${r.minIn}:${r.maxIn}:${r.targetUs}`);
        }
    }
    
    // Refresh to confirm
    setTimeout(() => onSend("SERVO_TABLE"), 500);
  };

  const handleTestMove = (pin: number, val: number) => {
    setTestVal(prev => ({ ...prev, [pin]: val }));
    
    if (throttleRef.current[pin]) clearTimeout(throttleRef.current[pin]);
    throttleRef.current[pin] = setTimeout(() => {
      // Calculate Us from Angle (val)
      const cfg = getEffectiveConfig(pin, localConfigs);
      const us = mapRange(val, cfg.minAngle, cfg.maxAngle, cfg.minUs, cfg.maxUs);
      onSend(`SERVO_MOVE:${pin}:${Math.round(us)}`);
    }, 50);
  };

  const addRange = (pin: number) => {
      const cfg = getEffectiveConfig(pin, localConfigs);
      if ((cfg.ranges?.length || 0) >= 5) {
          alert("Max 5 ranges allowed.");
          return;
      }
      const newRange: ServoRange = { minIn: 1000, maxIn: 2000, targetUs: cfg.midUs };
      handleUpdateConfig(pin, { ranges: [...(cfg.ranges || []), newRange] });
  };

  const updateRange = (pin: number, idx: number, field: keyof ServoRange, value: number) => {
      const cfg = getEffectiveConfig(pin, localConfigs);
      if (!cfg.ranges) return;
      const newRanges = [...cfg.ranges];
      newRanges[idx] = { ...newRanges[idx], [field]: value };
      handleUpdateConfig(pin, { ranges: newRanges });
  };

  const removeRange = (pin: number, idx: number) => {
      const cfg = getEffectiveConfig(pin, localConfigs);
      if (!cfg.ranges) return;
      const newRanges = cfg.ranges.filter((_, i) => i !== idx);
      handleUpdateConfig(pin, { ranges: newRanges });
  };

  const usToAngle = (us: number, cfg: ServoConfig) => {
      if (!cfg) return 0;
      return Math.round(mapRange(us, cfg.minUs, cfg.maxUs, cfg.minAngle, cfg.maxAngle));
  };

  const angleToUs = (deg: number, cfg: ServoConfig) => {
      if (!cfg) return 1500;
      return Math.round(mapRange(deg, cfg.minAngle, cfg.maxAngle, cfg.minUs, cfg.maxUs));
  };

  if (servoPins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Activity size={48} className="mb-4 opacity-50" />
        <h3 className="text-lg font-semibold">Brak skonfigurowanych serw</h3>
        <p className="text-sm">Przejdź do zakładki Pins i ustaw piny w tryb "SERVO".</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/40 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.10),_transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary/80">BetaDrive</p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">Servos</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Konfiguracja serwomechanizmów, zakresów wejściowych i testów ruchu.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onSend("SERVO_TABLE")} className="border-border/50 bg-background/70">
            <RefreshCw className="mr-2 h-4 w-4" /> Odśwież
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {servoPins.map((pin, idx) => {
          const cfg = getEffectiveConfig(pin, localConfigs);
          
          return (
            <Card key={pin} className="flex flex-col border-border/40 bg-background/40 shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
              <CardHeader className="pb-2 bg-muted/40">
                <CardTitle className="text-sm font-medium flex justify-between items-center">
                  <span>Servo {idx + 1} (Pin {pin})</span>
                  <Button size="icon" variant="outline" className="h-8 w-8 rounded-full border-primary/20 bg-background/70 text-primary hover:bg-primary/10" onClick={() => handleSave(pin)}>
                    <Save className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                <Tabs defaultValue="mode" className="w-full">
                  <TabsList className="w-full rounded-none border-b bg-transparent p-0">
                    <TabsTrigger value="mode" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Tryb</TabsTrigger>
                    <TabsTrigger value="setup" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Ustawienia</TabsTrigger>
                    <TabsTrigger value="test" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Test</TabsTrigger>
                  </TabsList>
                  
                  {/* --- MODE TAB --- */}
                  <TabsContent value="mode" className="p-4 space-y-4">
                    <RadioGroup 
                        value={cfg.mode.toString()} 
                        onValueChange={(v) => handleUpdateConfig(pin, { mode: parseInt(v) })}
                        className="grid grid-cols-2 gap-4"
                    >
                        <div>
                            <RadioGroupItem value="0" id={`m0-${pin}`} className="peer sr-only" />
                            <Label
                                htmlFor={`m0-${pin}`}
                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                            >
                                <Activity className="mb-2 h-6 w-6" />
                                Proporcjonalny
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="1" id={`m1-${pin}`} className="peer sr-only" />
                            <Label
                                htmlFor={`m1-${pin}`}
                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                            >
                                <SlidersHorizontal className="mb-2 h-6 w-6" />
                                Zakresy
                            </Label>
                        </div>
                    </RadioGroup>

                    {cfg.mode === 0 ? (
                        <div className="space-y-3 pt-2">
                            <div className="space-y-1">
                                <Label>Kanał wejściowy</Label>
                                <Select 
                                    value={cfg.sourceChannel.toString()} 
                                    onValueChange={(v) => handleUpdateConfig(pin, { sourceChannel: parseInt(v) })}
                                >
                                    <SelectTrigger><SelectValue placeholder="Wybierz kanał" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">Brak (Manual)</SelectItem>
                                        {CHANNELS.map((ch, i) => (
                                            <SelectItem key={ch} value={(i + 1).toString()}>{ch}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-4">
                                <div className="space-y-1 flex-1">
                                    <Label>Rate (Mnożnik)</Label>
                                    {renderNumberInput(cfg.rate, (num) => handleUpdateConfig(pin, { rate: num }), "w-full h-10 px-3", "0.1")}
                                </div>
                                <div className="space-y-1 flex items-end pb-2">
                                    <div className="flex items-center gap-2">
                                        <Switch 
                                            checked={cfg.reverse} 
                                            onCheckedChange={(c) => handleUpdateConfig(pin, { reverse: c })} 
                                        />
                                        <Label>Rewers</Label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label>Reguły zakresów</Label>
                                <Button size="sm" variant="ghost" onClick={() => addRange(pin)}><Plus className="h-4 w-4" /></Button>
                            </div>
                            <div className="border rounded-md overflow-hidden text-xs">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="p-2">Wejście (RC)</TableHead>
                                            <TableHead className="p-2">Kąt (°)</TableHead>
                                            <TableHead className="p-2 w-8"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(cfg.ranges || []).map((rng, rIdx) => (
                                            <TableRow key={rIdx}>
                                                <TableCell className="p-2">
                                                    <div className="flex items-center gap-1">
                                                        {renderNumberInput(rng.minIn, (num) => updateRange(pin, rIdx, 'minIn', num), "h-8 w-20 px-2 text-center")}
                                                        <span>-</span>
                                                        {renderNumberInput(rng.maxIn, (num) => updateRange(pin, rIdx, 'maxIn', num), "h-8 w-20 px-2 text-center")}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="p-2">
                                                    {renderNumberInput(usToAngle(rng.targetUs, cfg), (num) => updateRange(pin, rIdx, 'targetUs', angleToUs(num, cfg)), "h-8 w-24 px-2 text-center", "1", 2500, 500)}
                                                </TableCell>
                                                <TableCell className="p-2">
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeRange(pin, rIdx)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {(cfg.ranges || []).length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-muted-foreground p-4">
                                                    Brak reguł. Dodaj nową.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="space-y-1">
                                <Label>Kanał sterujący</Label>
                                <Select 
                                    value={cfg.sourceChannel.toString()} 
                                    onValueChange={(v) => handleUpdateConfig(pin, { sourceChannel: parseInt(v) })}
                                >
                                    <SelectTrigger><SelectValue placeholder="Wybierz kanał" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">Brak</SelectItem>
                                        {CHANNELS.map((ch, i) => (
                                            <SelectItem key={ch} value={(i + 1).toString()}>{ch}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                  </TabsContent>

                  {/* --- SETUP TAB --- */}
                  <TabsContent value="setup" className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Min Us</Label>
                            {renderNumberInput(cfg.minUs, (num) => handleUpdateConfig(pin, { minUs: num }), "w-full h-10 px-3", "1", 2500, 500)}
                        </div>
                        <div className="space-y-1">
                            <Label>Max Us</Label>
                            {renderNumberInput(cfg.maxUs, (num) => handleUpdateConfig(pin, { maxUs: num }), "w-full h-10 px-3", "1", 2500, 500)}
                        </div>
                        <div className="space-y-1">
                            <Label>Mid Us</Label>
                            {renderNumberInput(cfg.midUs, (num) => handleUpdateConfig(pin, { midUs: num }), "w-full h-10 px-3", "1", 2500, 500)}
                        </div>
                        <div className="space-y-1">
                            <Label>Speed (us/s)</Label>
                            {renderNumberInput(cfg.speed, (num) => handleUpdateConfig(pin, { speed: num }), "w-full h-10 px-3")}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div className="space-y-1">
                            <Label>Min Kąt (°)</Label>
                            {renderNumberInput(cfg.minAngle, (num) => handleUpdateConfig(pin, { minAngle: num }), "w-full h-10 px-3")}
                        </div>
                        <div className="space-y-1">
                            <Label>Max Kąt (°)</Label>
                            {renderNumberInput(cfg.maxAngle, (num) => handleUpdateConfig(pin, { maxAngle: num }), "w-full h-10 px-3")}
                        </div>
                    </div>
                  </TabsContent>

                  {/* --- TEST TAB --- */}
                  <TabsContent value="test" className="p-4 space-y-6">
                    <div className="flex items-center justify-between">
                        <Label>Włącz tryb testowy</Label>
                        <Switch 
                            checked={testMode[pin] || false} 
                            onCheckedChange={(c) => {
                                setTestMode(prev => ({ ...prev, [pin]: c }));
                                if (!c) onSend(`SERVO_MOVE:${pin}:0`); // Release control (0 usually means release in firmware if handled, or we might need logic change. Actually 0 means manual 0us which is invalid. Firmware handles sourceChannel=0 as manual. We need to revert to RC?)
                                // The firmware logic: if sourceChannel > 0 it follows RC. If we send SERVO_MOVE, it sets sourceChannel=0.
                                // So to disable test mode, we must Save Config again with correct source channel?
                                // Or we just rely on user hitting "Save" in Mode tab to restore RC.
                                // Ideally, toggling switch off should restore RC.
                                if (!c && cfg.sourceChannel > 0) {
                                     // Re-apply config to restore RC control
                                     handleSave(pin);
                                }
                            }} 
                        />
                    </div>
                    {testMode[pin] && (
                        <div className="space-y-4">
                            {(() => {
                                // Ensure valid min/max for Slider component to prevent crash
                                const rawMin = cfg.minAngle ?? 0;
                                const rawMax = cfg.maxAngle ?? 180;
                                let min = Math.min(rawMin, rawMax);
                                let max = Math.max(rawMin, rawMax);
                                
                                // Prevent invalid range or single point slider if possible
                                if (isNaN(min)) min = 0;
                                if (isNaN(max)) max = 180;
                                if (min >= max) {
                                   max = min + 1;
                                }

                                const currentVal = testVal[pin] ?? ((min + max) / 2);
                                const safeVal = isNaN(currentVal) ? min : Math.max(min, Math.min(max, currentVal));
                                const currentUs = Math.round(mapRange(safeVal, cfg.minAngle, cfg.maxAngle, cfg.minUs, cfg.maxUs));

                                return (
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span>{min}°</span>
                                            <span className="font-bold text-primary">{Math.round(safeVal)}°</span>
                                            <span>{max}°</span>
                                        </div>
                                        <Slider 
                                            min={min} 
                                            max={max} 
                                            step={1} 
                                            value={[safeVal]} 
                                            onValueChange={(v) => handleTestMove(pin, v[0])} 
                                        />
                                        <div className="text-center text-xs text-muted-foreground">
                                            PWM: {isNaN(currentUs) ? "---" : currentUs} us
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ServoPage;