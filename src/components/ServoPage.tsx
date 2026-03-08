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
  channels: boolean[];
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
      const newChannels = cfg.channels.map((_, i) => i === chIdx ? !cfg.channels[chIdx] : false);
      return { ...prev, [pin]: { ...cfg, channels: newChannels } };
    });
  };

  const handleManualMove = (pin: number, us: number) => {
    setManualUs(prev => ({ ...prev, [pin]: us }));
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

      {/* Per-servo cards: config + manual control */}
      <div className="space-y-3">
        {servoPins.map((pin, idx) => {
          const cfg = configs[pin];
          if (!cfg) return null;
          const us = manualUs[pin] ?? cfg.mid;
          const pos = livePositions[pin] ?? 1500;
          const pct = Math.max(0, Math.min(100, ((pos - cfg.min) / (cfg.max - cfg.min)) * 100));

          return (
            <div key={pin} className="border border-border rounded-lg overflow-hidden">
              {/* Servo header row */}
              <div className="flex items-center gap-3 px-3 py-2 bg-muted/40 border-b border-border">
                <span className="text-sm font-semibold text-primary">Servo {idx + 1}</span>
                <span className="text-[10px] text-muted-foreground font-mono">(GPIO {pin})</span>
                {/* Live position bar inline */}
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden border border-border">
                    <div className="h-full transition-all duration-150 rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: "hsl(var(--primary))", opacity: 0.8 }} />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground w-14 text-right">{pos} µs</span>
                </div>
              </div>

              {/* Config row: MIN / MID / MAX / Channel checkboxes / Rate */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-2 py-1 text-center text-[10px] font-semibold text-primary">MIN</th>
                      <th className="px-2 py-1 text-center text-[10px] font-semibold text-primary">MID</th>
                      <th className="px-2 py-1 text-center text-[10px] font-semibold text-primary">MAX</th>
                      {CHANNELS.map(ch => (
                        <th key={ch} className="px-0.5 py-1 text-center text-[10px] font-semibold text-foreground">{ch}</th>
                      ))}
                      <th className="px-2 py-1 text-center text-[10px] font-semibold text-primary">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-1 py-1.5">
                        <Input type="number" value={cfg.min}
                          onChange={e => handleFieldChange(pin, "min", parseInt(e.target.value) || 0)}
                          className="h-7 w-16 text-center text-xs" />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input type="number" value={cfg.mid}
                          onChange={e => handleFieldChange(pin, "mid", parseInt(e.target.value) || 0)}
                          className="h-7 w-16 text-center text-xs" />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input type="number" value={cfg.max}
                          onChange={e => handleFieldChange(pin, "max", parseInt(e.target.value) || 0)}
                          className="h-7 w-16 text-center text-xs" />
                      </td>
                      {cfg.channels.map((checked, chIdx) => (
                        <td key={chIdx} className="px-0.5 py-1.5 text-center">
                          <Checkbox checked={checked}
                            onCheckedChange={() => handleChannelToggle(pin, chIdx)}
                            className="h-3.5 w-3.5" />
                        </td>
                      ))}
                      <td className="px-1 py-1.5">
                        <Select value={cfg.rate} onValueChange={v => handleFieldChange(pin, "rate", v)}>
                          <SelectTrigger className="h-7 w-16 text-xs">
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
                  </tbody>
                </table>
              </div>

              {/* Manual control slider — always visible */}
              <div className="flex items-center gap-3 px-3 py-2 bg-muted/10 border-t border-border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-14 shrink-0">Ręczne</span>
                <Slider min={cfg.min} max={cfg.max} step={1}
                  value={[us]}
                  onValueChange={([v]) => handleManualMove(pin, v)}
                  className="flex-1" />
                <span className="text-xs font-mono text-muted-foreground w-14 text-right">{us} µs</span>
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2"
                  onClick={() => handleManualMove(pin, cfg.min)}>
                  MIN
                </Button>
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2"
                  onClick={() => handleManualMove(pin, cfg.mid)}>
                  MID
                </Button>
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2"
                  onClick={() => handleManualMove(pin, cfg.max)}>
                  MAX
                </Button>
              </div>
            </div>
          );
        })}
      </div>

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
