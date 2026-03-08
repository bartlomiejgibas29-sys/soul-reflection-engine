import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal, RefreshCw, Save } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import type { PinConfig, ServoConfig } from "@/hooks/useSerial";

interface ServoPageProps {
  pinConfigs: PinConfig[];
  servoConfigs: ServoConfig[];
  onSend: (data: string) => Promise<void> | void;
}

const CHANNELS = ["CH1", "CH2", "CH3", "CH4", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"];

const RATE_OPTIONS = [
  { value: "0.5", label: "0.5x" },
  { value: "0.75", label: "0.75x" },
  { value: "1", label: "1.0x" },
  { value: "1.25", label: "1.25x" },
  { value: "1.5", label: "1.5x" },
  { value: "2", label: "2.0x" },
];

interface LocalServoConfig {
  min: number;
  mid: number;
  max: number;
  channels: boolean[];  // 16 booleans, one per RC channel
  rate: string;
  reverse: boolean;
  speed: number;
  frequency: number;
}

const ServoPage = ({ pinConfigs, servoConfigs, onSend }: ServoPageProps) => {
  const servoPins = pinConfigs.filter(p => p.mode === "SERVO").map(p => p.pin);
  const [configs, setConfigs] = useState<Record<number, LocalServoConfig>>({});
  const [livePositions, setLivePositions] = useState<Record<number, number>>({});
  const [manualUs, setManualUs] = useState<Record<number, number>>({});
  const throttleRef = useRef<Record<number, NodeJS.Timeout>>({});

  useEffect(() => {
    onSend("SERVO_TABLE");
  }, []);

  useEffect(() => {
    const map: Record<number, LocalServoConfig> = {};
    servoPins.forEach(pin => {
      const existing = servoConfigs.find(c => c.pin === pin);
      const channels = new Array(16).fill(false);
      if (existing && existing.sourceChannel >= 1) {
        channels[existing.sourceChannel - 1] = true;
      }
      map[pin] = {
        min: existing?.minUs ?? 1000,
        mid: existing?.midUs ?? 1500,
        max: existing?.maxUs ?? 2000,
        channels,
        rate: String(existing?.rate ?? 1),
        reverse: existing?.reverse ?? false,
        speed: existing?.speed ?? 0,
        frequency: existing?.frequency ?? 50,
      };
      // Init manual position to mid
      if (!manualUs[pin]) {
        setManualUs(prev => ({ ...prev, [pin]: existing?.midUs ?? 1500 }));
      }
    });
    setConfigs(map);

    const positions: Record<number, number> = {};
    servoPins.forEach(pin => {
      const pinConf = pinConfigs.find(p => p.pin === pin);
      positions[pin] = pinConf?.value ?? 1500;
    });
    setLivePositions(positions);
  }, [servoConfigs, pinConfigs]);

  const handleFieldChange = (pin: number, field: keyof LocalServoConfig, value: any) => {
    setConfigs(prev => ({
      ...prev,
      [pin]: { ...prev[pin], [field]: value }
    }));
  };

  const handleChannelToggle = (pin: number, chIdx: number) => {
    setConfigs(prev => {
      const cfg = prev[pin];
      if (!cfg) return prev;
      // Radio-button style: only one channel at a time
      const newChannels = cfg.channels.map((_, i) => i === chIdx ? !cfg.channels[chIdx] : false);
      return { ...prev, [pin]: { ...cfg, channels: newChannels } };
    });
  };

  const handleManualMove = (pin: number, us: number) => {
    setManualUs(prev => ({ ...prev, [pin]: us }));
    // Throttle serial sends to ~20Hz
    if (throttleRef.current[pin]) clearTimeout(throttleRef.current[pin]);
    throttleRef.current[pin] = setTimeout(() => {
      onSend(`SERVO_MOVE:${pin}:${us}`);
    }, 50);
  };

  const handleSaveAll = async () => {
    for (const pin of servoPins) {
      const cfg = configs[pin];
      if (!cfg) continue;
      const sourceChannel = cfg.channels.findIndex(c => c) + 1;
      const actualSource = sourceChannel > 0 ? sourceChannel : 0;
      // SET_SERVO_CFG:pin:freq:min:mid:max:src:rev:rate:speed
      const cmd = `SET_SERVO_CFG:${pin}:${cfg.frequency}:${cfg.min}:${cfg.mid}:${cfg.max}:${actualSource}:${cfg.reverse ? 1 : 0}:${cfg.rate}:${cfg.speed}`;
      await onSend(cmd);
    }
  };

  if (servoPins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <SlidersHorizontal size={48} className="mb-4 opacity-50" />
        <h3 className="text-lg font-semibold">Brak skonfigurowanych serw</h3>
        <p className="text-sm">Przejdź do zakładki Pins i ustaw piny w tryb "SERVO".</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* Header */}
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

      {/* Info bar */}
      <div className="text-center text-xs text-primary font-medium bg-primary/10 rounded py-1.5">
        Zmień kierunek w TX, aby dopasować
      </div>

      {/* Config Table */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-primary whitespace-nowrap">Nazwa</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-primary whitespace-nowrap">MIN</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-primary whitespace-nowrap">MID</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-primary whitespace-nowrap">MAX</th>
              {CHANNELS.map(ch => (
                <th key={ch} className="px-1 py-2 text-center text-xs font-semibold text-foreground whitespace-nowrap">{ch}</th>
              ))}
              <th className="px-2 py-2 text-center text-xs font-semibold text-primary whitespace-nowrap">Rate</th>
            </tr>
          </thead>
          <tbody>
            {servoPins.map((pin, idx) => {
              const cfg = configs[pin];
              if (!cfg) return null;
              return (
                <tr key={pin} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-primary font-medium whitespace-nowrap">
                    Servo {idx + 1}
                    <span className="text-[10px] text-muted-foreground ml-1">(GPIO {pin})</span>
                  </td>
                  <td className="px-1 py-1.5">
                    <Input type="number" value={cfg.min}
                      onChange={e => handleFieldChange(pin, "min", parseInt(e.target.value) || 0)}
                      className="h-8 w-20 text-center text-xs" />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input type="number" value={cfg.mid}
                      onChange={e => handleFieldChange(pin, "mid", parseInt(e.target.value) || 0)}
                      className="h-8 w-20 text-center text-xs" />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input type="number" value={cfg.max}
                      onChange={e => handleFieldChange(pin, "max", parseInt(e.target.value) || 0)}
                      className="h-8 w-20 text-center text-xs" />
                  </td>
                  {cfg.channels.map((checked, chIdx) => (
                    <td key={chIdx} className="px-1 py-1.5 text-center">
                      <Checkbox checked={checked}
                        onCheckedChange={() => handleChannelToggle(pin, chIdx)}
                        className="h-4 w-4" />
                    </td>
                  ))}
                  <td className="px-1 py-1.5">
                    <Select value={cfg.rate} onValueChange={v => handleFieldChange(pin, "rate", v)}>
                      <SelectTrigger className="h-8 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RATE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Live servo position bars + manual control */}
      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-center mb-3 text-foreground">Serwa — podgląd na żywo</h3>
        <div className="flex items-end justify-center gap-3 flex-wrap">
          {servoPins.map((pin, idx) => {
            const cfg = configs[pin];
            const pos = livePositions[pin] ?? 1500;
            const min = cfg?.min ?? 1000;
            const max = cfg?.max ?? 2000;
            const mid = cfg?.mid ?? 1500;
            const pct = Math.max(0, Math.min(100, ((pos - min) / (max - min)) * 100));
            const hasSource = cfg?.channels.some(c => c) ?? false;

            return (
              <div key={pin} className="flex flex-col items-center w-16">
                <span className={`text-xs font-bold mb-1 ${idx < 4 ? "text-primary" : "text-destructive"}`}>
                  {idx + 1}
                </span>
                <div className="w-full h-24 bg-muted rounded border border-border relative overflow-hidden">
                  {/* Mid-point marker */}
                  <div className="absolute w-full border-t border-dashed border-muted-foreground/30"
                    style={{ bottom: `${((mid - min) / (max - min)) * 100}%` }} />
                  <div
                    className="absolute bottom-0 w-full transition-all duration-150"
                    style={{
                      height: `${pct}%`,
                      backgroundColor: "hsl(var(--primary))",
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground mt-1">{pos}</span>
              </div>
            );
          })}
        </div>

        {/* Manual sliders for servos without source channel */}
        {servoPins.some(pin => {
          const cfg = configs[pin];
          return cfg && !cfg.channels.some(c => c);
        }) && (
          <div className="mt-4 space-y-2 border-t border-border pt-3">
            <p className="text-[10px] text-muted-foreground text-center uppercase tracking-wider">Sterowanie ręczne (serwa bez przypisanego kanału)</p>
            {servoPins.map((pin, idx) => {
              const cfg = configs[pin];
              if (!cfg || cfg.channels.some(c => c)) return null;
              const us = manualUs[pin] ?? cfg.mid;
              return (
                <div key={pin} className="flex items-center gap-3">
                  <span className="text-xs text-primary font-medium w-16">Servo {idx + 1}</span>
                  <Slider min={cfg.min} max={cfg.max} step={1}
                    value={[us]}
                    onValueChange={([v]) => handleManualMove(pin, v)}
                    className="flex-1" />
                  <span className="text-xs font-mono text-muted-foreground w-12 text-right">{us}µs</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2"
                    onClick={() => handleManualMove(pin, cfg.mid)}>
                    Center
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSaveAll} className="px-6">
          <Save className="mr-2 h-4 w-4" />
          Zapisz
        </Button>
      </div>
    </div>
  );
};

export default ServoPage;
