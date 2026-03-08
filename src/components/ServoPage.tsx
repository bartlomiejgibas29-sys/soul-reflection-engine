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

type ServoControlMode = "MANUAL" | "RC";

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
  control: ServoControlMode;
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
  const throttleRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    onSend("SERVO_TABLE");
  }, [onSend]);

  useEffect(() => {
    return () => {
      Object.values(throttleRef.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const map: Record<number, LocalServoConfig> = {};
    const existingByPin = new Map(servoConfigs.map(c => [c.pin, c]));

    servoPins.forEach(pin => {
      const existing = existingByPin.get(pin);
      const channels = new Array(16).fill(false);
      if (existing && existing.sourceChannel >= 1) {
        channels[existing.sourceChannel - 1] = true;
      }

      map[pin] = {
        min: existing?.minUs ?? 1000,
        mid: existing?.midUs ?? 1500,
        max: existing?.maxUs ?? 2000,
        channels,
        control: existing?.sourceChannel && existing.sourceChannel >= 1 ? "RC" : "MANUAL",
        rate: String(existing?.rate ?? 1),
        reverse: existing?.reverse ?? false,
        speed: existing?.speed ?? 0,
        frequency: existing?.frequency ?? 50,
      };
    });

    setConfigs(map);

    setManualUs(prev => {
      const next = { ...prev };
      servoPins.forEach(pin => {
        if (next[pin] == null) {
          const existing = existingByPin.get(pin);
          next[pin] = existing?.midUs ?? 1500;
        }
      });
      return next;
    });

    const positions: Record<number, number> = {};
    servoPins.forEach(pin => {
      const pinConf = pinConfigs.find(p => p.pin === pin);
      positions[pin] = pinConf?.value ?? 1500;
    });
    setLivePositions(positions);
  }, [servoConfigs, pinConfigs]);

  const handleFieldChange = (pin: number, field: keyof LocalServoConfig, value: string | number | boolean | boolean[]) => {
    setConfigs(prev => ({
      ...prev,
      [pin]: { ...prev[pin], [field]: value }
    }));
  };

  const handleControlModeChange = (pin: number, mode: ServoControlMode) => {
    setConfigs(prev => {
      const cfg = prev[pin];
      if (!cfg) return prev;

      const hasChannel = cfg.channels.some(Boolean);
      const channels =
        mode === "MANUAL"
          ? new Array(16).fill(false)
          : hasChannel
            ? cfg.channels
            : cfg.channels.map((_, i) => i === 0);

      return {
        ...prev,
        [pin]: {
          ...cfg,
          control: mode,
          channels,
        },
      };
    });
  };

  const handleChannelToggle = (pin: number, chIdx: number) => {
    setConfigs(prev => {
      const cfg = prev[pin];
      if (!cfg) return prev;

      const wasChecked = cfg.channels[chIdx];
      const newChannels = cfg.channels.map((_, i) => (i === chIdx ? !wasChecked : false));

      return {
        ...prev,
        [pin]: {
          ...cfg,
          channels: newChannels,
          control: newChannels.some(Boolean) ? "RC" : "MANUAL",
        },
      };
    });
  };

  const handleManualMove = (pin: number, us: number) => {
    setConfigs(prev => {
      const cfg = prev[pin];
      if (!cfg || cfg.control === "MANUAL") return prev;
      return {
        ...prev,
        [pin]: {
          ...cfg,
          control: "MANUAL",
          channels: new Array(16).fill(false),
        },
      };
    });

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

      const selectedChannel = cfg.channels.findIndex(c => c) + 1;
      const actualSource = cfg.control === "RC" ? (selectedChannel > 0 ? selectedChannel : 1) : 0;
      const cmd = `SET_SERVO_CFG:${pin}:${cfg.frequency}:${cfg.min}:${cfg.mid}:${cfg.max}:${actualSource}:${cfg.reverse ? 1 : 0}:${cfg.rate}:${cfg.speed}`;
      await onSend(cmd);
    }

    onSend("SERVO_TABLE");
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

      <div className="text-center text-xs text-primary font-medium bg-primary/10 rounded py-1.5">
        Manual = suwak, RC = wybrany kanał + Zapisz
      </div>

      <div className="space-y-3">
        {servoPins.map((pin, idx) => {
          const cfg = configs[pin];
          if (!cfg) return null;

          const us = manualUs[pin] ?? cfg.mid;
          const pos = livePositions[pin] ?? 1500;
          const range = Math.max(1, cfg.max - cfg.min);
          const pct = Math.max(0, Math.min(100, ((pos - cfg.min) / range) * 100));

          return (
            <div key={pin} className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 bg-muted/40 border-b border-border">
                <span className="text-sm font-semibold text-primary">Servo {idx + 1}</span>
                <span className="text-[10px] text-muted-foreground font-mono">(GPIO {pin})</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full transition-all duration-150 rounded-full bg-primary/80"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground w-14 text-right">{pos} µs</span>
                </div>
              </div>

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
                      <th className="px-2 py-1 text-center text-[10px] font-semibold text-primary">CTRL</th>
                      <th className="px-2 py-1 text-center text-[10px] font-semibold text-primary">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          value={cfg.min}
                          onChange={e => handleFieldChange(pin, "min", parseInt(e.target.value) || 0)}
                          className="h-7 w-16 text-center text-xs"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          value={cfg.mid}
                          onChange={e => handleFieldChange(pin, "mid", parseInt(e.target.value) || 0)}
                          className="h-7 w-16 text-center text-xs"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          value={cfg.max}
                          onChange={e => handleFieldChange(pin, "max", parseInt(e.target.value) || 0)}
                          className="h-7 w-16 text-center text-xs"
                        />
                      </td>
                      {cfg.channels.map((checked, chIdx) => (
                        <td key={chIdx} className="px-0.5 py-1.5 text-center">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => handleChannelToggle(pin, chIdx)}
                            className="h-3.5 w-3.5"
                          />
                        </td>
                      ))}
                      <td className="px-1 py-1.5">
                        <Select value={cfg.control} onValueChange={v => handleControlModeChange(pin, v as ServoControlMode)}>
                          <SelectTrigger className="h-7 w-20 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MANUAL">Manual</SelectItem>
                            <SelectItem value="RC">RC</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
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

              <div className="flex items-center gap-3 px-3 py-2 bg-muted/10 border-t border-border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-14 shrink-0">Ręczne</span>
                <Slider
                  min={cfg.min}
                  max={cfg.max}
                  step={1}
                  value={[us]}
                  onValueChange={([v]) => handleManualMove(pin, v)}
                  disabled={cfg.control === "RC"}
                  className="flex-1"
                />
                <span className="text-xs font-mono text-muted-foreground w-14 text-right">{us} µs</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => handleManualMove(pin, cfg.min)}
                  disabled={cfg.control === "RC"}
                >
                  MIN
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => handleManualMove(pin, cfg.mid)}
                  disabled={cfg.control === "RC"}
                >
                  MID
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => handleManualMove(pin, cfg.max)}
                  disabled={cfg.control === "RC"}
                >
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
