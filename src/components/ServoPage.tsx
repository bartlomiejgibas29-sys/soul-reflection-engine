import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal, RefreshCw, Save } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { PinConfig, ServoConfig } from "@/hooks/useSerial";

interface ServoPageProps {
  pinConfigs: PinConfig[];
  servoConfigs: ServoConfig[];
  onSend: (data: string) => Promise<void> | void;
}

const CHANNELS = ["CH1", "CH2", "CH3", "CH4", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"];

const DEFLECTION_OPTIONS = [
  { value: "1", label: "Wychylenie: 1x" },
  { value: "0.5", label: "Wychylenie: 0.5x" },
  { value: "1.5", label: "Wychylenie: 1.5x" },
  { value: "2", label: "Wychylenie: 2x" },
];

const ServoPage = ({ pinConfigs, servoConfigs, onSend }: ServoPageProps) => {
  const servoPins = pinConfigs.filter(p => p.mode === "SERVO").map(p => p.pin);

  const [configs, setConfigs] = useState<Record<number, {
    min: number;
    mid: number;
    max: number;
    channels: boolean[];
    deflection: string;
    speed: number;
    frequency: number;
  }>>({});

  const [livePositions, setLivePositions] = useState<Record<number, number>>({});

  useEffect(() => {
    onSend("SERVO_TABLE");
  }, []);

  useEffect(() => {
    const map: Record<number, any> = {};
    servoPins.forEach((pin, _idx) => {
      const existing = servoConfigs.find(c => c.pin === pin);
      const channels = new Array(16).fill(false);
      if (existing && existing.sourceChannel >= 1) {
        channels[existing.sourceChannel - 1] = true;
      }
      map[pin] = {
        min: existing?.minPulse ?? 1000,
        mid: existing ? Math.round((existing.minPulse + existing.maxPulse) / 2) : 1500,
        max: existing?.maxPulse ?? 2000,
        channels,
        deflection: "1",
        speed: existing?.speed ?? 0,
        frequency: existing?.frequency ?? 50,
      };
    });
    setConfigs(map);

    // Update live positions
    const positions: Record<number, number> = {};
    servoPins.forEach(pin => {
      const pinConf = pinConfigs.find(p => p.pin === pin);
      positions[pin] = pinConf?.value ?? 1500;
    });
    setLivePositions(positions);
  }, [servoConfigs, pinConfigs]);

  const handleFieldChange = (pin: number, field: string, value: any) => {
    setConfigs(prev => ({
      ...prev,
      [pin]: { ...prev[pin], [field]: value }
    }));
  };

  const handleChannelToggle = (pin: number, chIdx: number) => {
    setConfigs(prev => {
      const cfg = prev[pin];
      if (!cfg) return prev;
      const channels = [...cfg.channels];
      // Only one channel active at a time
      const newChannels = channels.map((_, i) => i === chIdx ? !channels[chIdx] : false);
      return { ...prev, [pin]: { ...cfg, channels: newChannels } };
    });
  };

  const handleSaveAll = async () => {
    for (const pin of servoPins) {
      const cfg = configs[pin];
      if (!cfg) continue;
      const sourceChannel = cfg.channels.findIndex(c => c) + 1; // 0 if none
      const actualSource = sourceChannel > 0 ? sourceChannel : 0;
      // Build command with 2 default points
      const cmd = `SET_SERVO_CFG:${pin}:${cfg.frequency}:${cfg.min}:${cfg.max}:${cfg.speed}:${actualSource}:2:${cfg.min}:0:1:${cfg.max}:180:1`;
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

      {/* Table */}
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
              <th className="px-2 py-2 text-center text-xs font-semibold text-primary whitespace-nowrap">Wychylenie i kierunek</th>
            </tr>
          </thead>
          <tbody>
            {servoPins.map((pin, idx) => {
              const cfg = configs[pin];
              if (!cfg) return null;
              return (
                <tr key={pin} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-primary font-medium whitespace-nowrap">Servo {idx + 1}</td>
                  <td className="px-1 py-1.5">
                    <Input
                      type="number"
                      value={cfg.min}
                      onChange={e => handleFieldChange(pin, "min", parseInt(e.target.value) || 0)}
                      className="h-8 w-20 text-center text-xs"
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      type="number"
                      value={cfg.mid}
                      onChange={e => handleFieldChange(pin, "mid", parseInt(e.target.value) || 0)}
                      className="h-8 w-20 text-center text-xs"
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      type="number"
                      value={cfg.max}
                      onChange={e => handleFieldChange(pin, "max", parseInt(e.target.value) || 0)}
                      className="h-8 w-20 text-center text-xs"
                    />
                  </td>
                  {cfg.channels.map((checked, chIdx) => (
                    <td key={chIdx} className="px-1 py-1.5 text-center">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => handleChannelToggle(pin, chIdx)}
                        className="h-4 w-4"
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1.5">
                    <Select value={cfg.deflection} onValueChange={v => handleFieldChange(pin, "deflection", v)}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFLECTION_OPTIONS.map(o => (
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

      {/* Live servo positions */}
      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-center mb-3 text-foreground">Serwa</h3>
        <div className="flex items-end justify-center gap-2 flex-wrap">
          {servoPins.map((pin, idx) => {
            const cfg = configs[pin];
            const pos = livePositions[pin] ?? 1500;
            const min = cfg?.min ?? 1000;
            const max = cfg?.max ?? 2000;
            const pct = Math.max(0, Math.min(100, ((pos - min) / (max - min)) * 100));

            return (
              <div key={pin} className="flex flex-col items-center w-16">
                <span className={`text-xs font-bold mb-1 ${idx < 4 ? "text-primary" : "text-destructive"}`}>
                  {idx + 1}
                </span>
                <div className="w-full h-24 bg-muted rounded border border-border relative overflow-hidden">
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
      </div>

      {/* Save button */}
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
