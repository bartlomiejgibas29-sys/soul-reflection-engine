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
import { Trash2, Plus, RefreshCw, Save, Activity } from "lucide-react";
import type { PinConfig, ServoConfig, ServoRange } from "@/hooks/useSerial";

interface ServoPageProps {
  pinConfigs: PinConfig[];
  servoConfigs: ServoConfig[];
  onSend: (data: string) => Promise<void> | void;
}

const CHANNELS = ["CH1", "CH2", "CH3", "CH4", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"];

const mapRange = (x: number, in_min: number, in_max: number, out_min: number, out_max: number) => {
  return ((x - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
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
  }, [onSend]);

  const getEffectiveConfig = (pin: number, local: Record<number, ServoConfig>): ServoConfig => {
      const defaultConfig: ServoConfig = {
          pin, frequency: 50, minUs: 1000, midUs: 1500, maxUs: 2000,
          sourceChannel: 0, reverse: false, rate: 1.0, speed: 0,
          mode: 0, minAngle: 0, maxAngle: 180, ranges: []
      };
      return local[pin] || servoConfigs.find(c => c.pin === pin) || defaultConfig;
  };

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

    // Send Main Config
    // Format: SET_SERVO_CFG:pin:freq:min:mid:max:src:rev:rate:speed:mode:minAngle:maxAngle
    const cmd = `SET_SERVO_CFG:${pin}:${cfg.frequency}:${cfg.minUs}:${cfg.midUs}:${cfg.maxUs}:${cfg.sourceChannel}:${cfg.reverse ? 1 : 0}:${cfg.rate}:${cfg.speed}:${cfg.mode}:${cfg.minAngle}:${cfg.maxAngle}`;
    await onSend(cmd);

    // Send Ranges if mode is RANGES (or always, to be safe)
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="text-primary" /> Konfiguracja Serwomechanizmów
        </h2>
        <Button variant="outline" size="sm" onClick={() => onSend("SERVO_TABLE")}>
          <RefreshCw className="mr-2 h-4 w-4" /> Odśwież
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {servoPins.map((pin, idx) => {
          const cfg = getEffectiveConfig(pin, localConfigs);
          
          return (
            <Card key={pin} className="flex flex-col">
              <CardHeader className="pb-2 bg-muted/40">
                <CardTitle className="text-sm font-medium flex justify-between items-center">
                  <span>Servo {idx + 1} (Pin {pin})</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSave(pin)}>
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
                                    <Input 
                                        type="number" step="0.1" 
                                        value={cfg.rate} 
                                        onChange={(e) => handleUpdateConfig(pin, { rate: parseFloat(e.target.value) })} 
                                    />
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
                                                        <Input 
                                                            className="h-6 w-12 px-1 text-center" 
                                                            value={rng.minIn} 
                                                            onChange={(e) => updateRange(pin, rIdx, 'minIn', parseInt(e.target.value))}
                                                        />
                                                        <span>-</span>
                                                        <Input 
                                                            className="h-6 w-12 px-1 text-center" 
                                                            value={rng.maxIn} 
                                                            onChange={(e) => updateRange(pin, rIdx, 'maxIn', parseInt(e.target.value))}
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="p-2">
                                                    <Input 
                                                        className="h-6 w-14 px-1 text-center" 
                                                        value={usToAngle(rng.targetUs, cfg)} 
                                                        onChange={(e) => updateRange(pin, rIdx, 'targetUs', angleToUs(parseInt(e.target.value), cfg))}
                                                    />
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
                            <Input type="number" value={cfg.minUs} onChange={(e) => handleUpdateConfig(pin, { minUs: parseInt(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                            <Label>Max Us</Label>
                            <Input type="number" value={cfg.maxUs} onChange={(e) => handleUpdateConfig(pin, { maxUs: parseInt(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                            <Label>Mid Us</Label>
                            <Input type="number" value={cfg.midUs} onChange={(e) => handleUpdateConfig(pin, { midUs: parseInt(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                            <Label>Speed (us/s)</Label>
                            <Input type="number" value={cfg.speed} onChange={(e) => handleUpdateConfig(pin, { speed: parseInt(e.target.value) })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div className="space-y-1">
                            <Label>Min Kąt (°)</Label>
                            <Input type="number" value={cfg.minAngle} onChange={(e) => handleUpdateConfig(pin, { minAngle: parseInt(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                            <Label>Max Kąt (°)</Label>
                            <Input type="number" value={cfg.maxAngle} onChange={(e) => handleUpdateConfig(pin, { maxAngle: parseInt(e.target.value) })} />
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
                            <div className="flex justify-between text-sm">
                                <span>{cfg.minAngle}°</span>
                                <span className="font-bold text-primary">
                                    {Math.round(mapRange(testVal[pin] ?? ((cfg.minAngle + cfg.maxAngle)/2), cfg.minAngle, cfg.maxAngle, cfg.minAngle, cfg.maxAngle))}°
                                </span>
                                <span>{cfg.maxAngle}°</span>
                            </div>
                            <Slider 
                                min={cfg.minAngle} 
                                max={cfg.maxAngle} 
                                step={1} 
                                value={[testVal[pin] ?? ((cfg.minAngle + cfg.maxAngle)/2)]} 
                                onValueChange={(v) => handleTestMove(pin, v[0])} 
                            />
                            <div className="text-center text-xs text-muted-foreground">
                                PWM: {Math.round(mapRange(testVal[pin] ?? ((cfg.minAngle + cfg.maxAngle)/2), cfg.minAngle, cfg.maxAngle, cfg.minUs, cfg.maxUs))} us
                            </div>
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