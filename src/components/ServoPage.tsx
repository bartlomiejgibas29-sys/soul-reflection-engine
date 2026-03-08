import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal, RefreshCw, Save, Activity, Plus, Trash2, Play } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { PinConfig, ServoConfig, ServoPoint } from "@/hooks/useSerial";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface ServoPageProps {
  pinConfigs: PinConfig[];
  servoConfigs: ServoConfig[];
  onSend: (data: string) => Promise<void> | void;
}

const ServoPage = ({ pinConfigs, servoConfigs, onSend }: ServoPageProps) => {
  const [localConfigs, setLocalConfigs] = useState<Record<number, ServoConfig>>({});
  const [loading, setLoading] = useState(false);

  // Filter pins that are set to SERVO mode
  const servoPins = pinConfigs.filter(p => p.mode === "SERVO").map(p => p.pin);

  useEffect(() => {
    // Request current servo configs when mounting
    onSend("SERVO_TABLE");
  }, []);

  useEffect(() => {
    const map: Record<number, ServoConfig> = {};
    servoConfigs.forEach(c => {
      map[c.pin] = c;
    });
    // For pins that are SERVO but have no config yet, create default
    servoPins.forEach(pin => {
      if (!map[pin]) {
        map[pin] = {
          pin,
          frequency: 50,
          minPulse: 500,
          maxPulse: 2500,
          speed: 0,
          sourceChannel: 0,
          numPoints: 2,
          points: [
            { inValue: 1000, outAngle: 0, proportional: true },
            { inValue: 2000, outAngle: 180, proportional: true }
          ]
        };
      }
    });
    setLocalConfigs(map);
  }, [servoConfigs, pinConfigs]);

  const handleChange = (pin: number, field: keyof ServoConfig, value: any) => {
    setLocalConfigs(prev => ({
      ...prev,
      [pin]: { ...prev[pin], [field]: value }
    }));
  };

  const handlePointChange = (pin: number, idx: number, field: keyof ServoPoint, value: any) => {
    setLocalConfigs(prev => {
      const config = prev[pin];
      if (!config || !config.points) return prev;
      const newPoints = [...config.points];
      newPoints[idx] = { ...newPoints[idx], [field]: value };
      
      // If we change inValue, we should sort
      if (field === "inValue") {
        newPoints.sort((a, b) => (a.inValue || 0) - (b.inValue || 0));
      }
      
      return {
        ...prev,
        [pin]: { ...config, points: newPoints }
      };
    });
  };

  const addPoint = (pin: number) => {
    setLocalConfigs(prev => {
      const config = prev[pin];
      if (!config || (config.points && config.points.length >= 8)) return prev;
      
      const points = config.points || [];
      const lastPoint = points.length > 0 
        ? points[points.length - 1] 
        : { inValue: 1000, outAngle: 90, proportional: true };

      const newPoint = { 
        inValue: Math.min(2000, lastPoint.inValue + 100), 
        outAngle: Math.min(180, lastPoint.outAngle + 10),
        proportional: true
      };

      const newPoints = [...points, newPoint].sort((a, b) => a.inValue - b.inValue);

      return {
        ...prev,
        [pin]: { 
          ...config, 
          points: newPoints,
          numPoints: newPoints.length
        }
      };
    });
  };

  const removePoint = (pin: number, idx: number) => {
    setLocalConfigs(prev => {
      const config = prev[pin];
      if (!config || !config.points || config.points.length <= 1) return prev;
      const newPoints = config.points.filter((_, i) => i !== idx);
      return {
        ...prev,
        [pin]: { 
          ...config, 
          points: newPoints,
          numPoints: newPoints.length
        }
      };
    });
  };

  const [manualAngles, setManualAngles] = useState<Record<number, number>>({});

  const handleManualMove = async (pin: number, angle: number) => {
    setManualAngles(prev => ({ ...prev, [pin]: angle }));
    await onSend(`SERVO_MOVE:${pin}:${angle}`);
  };

  const handleSave = async (pin: number) => {
    const c = localConfigs[pin];
    if (!c) return;
    setLoading(true);
    // Command format: SET_SERVO_CFG:pin:freq:min:max:speed:src:npts:i1:o1:p1:i2:o2:p2...
    let cmd = `SET_SERVO_CFG:${c.pin}:${c.frequency}:${c.minPulse}:${c.maxPulse}:${c.speed}:${c.sourceChannel}:${c.points.length}`;
    c.points.forEach(p => {
      cmd += `:${p.inValue}:${p.outAngle}:${p.proportional ? 1 : 0}`;
    });
    await onSend(cmd);
    setTimeout(() => setLoading(false), 500);
  };

  if (servoPins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <SlidersHorizontal size={48} className="mb-4 opacity-50" />
        <h3 className="text-lg font-semibold">No Servo Pins Configured</h3>
        <p>Go to the Pins tab and set some pins to "SERVO" mode first.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="text-primary" />
          <h2 className="text-lg font-semibold">Servo Mixer</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => onSend("SERVO_TABLE")}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {servoPins.map(pin => {
          const config = localConfigs[pin];
          if (!config) return null;
          
          // Get current value from pinConfigs if available
          const currentVal = pinConfigs.find(p => p.pin === pin)?.value ?? 0;

          return (
            <Card key={pin} className="p-4 border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">GPIO {pin}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-blue-500" />
                  <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                    POS: {currentVal}
                  </div>
                  <Button size="sm" onClick={() => handleSave(pin)} disabled={loading}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Hardware Settings */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground border-b border-border pb-1">Hardware Limits</h4>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Frequency (Hz)</Label>
                      <Input 
                        type="number" 
                        value={config.frequency} 
                        onChange={e => handleChange(pin, "frequency", parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Speed (deg/s)</Label>
                      <Input 
                        type="number" 
                        value={config.speed} 
                        onChange={e => handleChange(pin, "speed", parseInt(e.target.value))}
                        placeholder="0=Instant"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Min Pulse (us)</Label>
                      <Input 
                        type="number" 
                        value={config.minPulse} 
                        onChange={e => handleChange(pin, "minPulse", parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max Pulse (us)</Label>
                      <Input 
                        type="number" 
                        value={config.maxPulse} 
                        onChange={e => handleChange(pin, "maxPulse", parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                {/* Mixer / Logic Settings */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-1">
                    <h4 className="text-sm font-medium text-muted-foreground">AUX Binding</h4>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Source Channel</Label>
                    <Select 
                      value={config.sourceChannel.toString()} 
                      onValueChange={val => handleChange(pin, "sourceChannel", parseInt(val))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">None (Manual/Fixed)</SelectItem>
                        
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase text-muted-foreground px-2 py-1.5">Stick Channels</SelectLabel>
                          {Array.from({length: 4}).map((_, i) => (
                            <SelectItem key={i+1} value={(i+1).toString()}>Channel {i+1}</SelectItem>
                          ))}
                        </SelectGroup>

                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase text-muted-foreground px-2 py-1.5">AUX Channels</SelectLabel>
                          {Array.from({length: 12}).map((_, i) => (
                            <SelectItem key={i+5} value={(i+5).toString()}>AUX {i+1} (CH {i+5})</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_1fr_40px_32px] gap-2 items-center px-1">
                      <div className="text-[10px] font-semibold text-muted-foreground text-center">Input</div>
                      <div className="text-[10px] font-semibold text-muted-foreground text-center">Angle</div>
                      <div className="text-[10px] font-semibold text-muted-foreground text-center">Prop</div>
                      <div></div>
                    </div>

                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {config.points.map((pt, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_1fr_40px_32px] gap-2 items-center">
                          <Input 
                            type="number" 
                            value={pt.inValue} 
                            onChange={e => handlePointChange(pin, idx, "inValue", parseInt(e.target.value))}
                            className="h-8 text-center px-1"
                          />
                          <Input 
                            type="number" 
                            value={pt.outAngle} 
                            onChange={e => handlePointChange(pin, idx, "outAngle", parseInt(e.target.value))}
                            className="h-8 text-center px-1"
                          />
                          <div className="flex justify-center">
                            <Switch 
                              checked={pt.proportional} 
                              onCheckedChange={checked => handlePointChange(pin, idx, "proportional", checked)}
                              className="scale-75"
                            />
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removePoint(pin, idx)}
                            disabled={config.points.length <= 1}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-8 border-dashed"
                      onClick={() => addPoint(pin)}
                      disabled={config.points.length >= 8}
                    >
                      <Plus size={14} className="mr-2" />
                      Add Point
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ServoPage;
