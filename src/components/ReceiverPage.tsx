import { useEffect, useState } from "react";
import type { ReceiverData, ReceiverSettings } from "@/hooks/useSerial";
import { Radio, Signal, Zap, Antenna, Activity, RefreshCw, Gamepad2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ReceiverPageProps {
  data: ReceiverData | null;
  settings: ReceiverSettings | null;
  onSend: (data: string) => Promise<void> | void;
}

const StatCard = ({ icon: Icon, label, value, unit, accent }: {
  icon?: any; label: string; value: string; unit?: string; accent?: boolean;
}) => (
  <div className={`flex items-center gap-3 p-3 rounded-lg border ${accent ? 'bg-primary/5 border-primary/20' : 'bg-[hsl(0,0%,10%)] border-border/20'}`}>
    {Icon && <Icon size={14} className={accent ? "text-primary" : "text-muted-foreground"} />}
    <div className="flex-1 min-w-0">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</div>
    </div>
    <div className="text-right shrink-0">
      <span className={`font-mono text-sm font-bold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</span>
      {unit && <span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span>}
    </div>
  </div>
);

const ReceiverPage = ({ data, settings, onSend }: ReceiverPageProps) => {
  useEffect(() => {
    onSend("ENABLE_RECEIVER_MODE");
    onSend("RX_SETTINGS");
    return () => { onSend("DISABLE_RECEIVER_MODE"); };
  }, []);

  const [form, setForm] = useState<ReceiverSettings | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const handleSwitchChange = (key: keyof ReceiverSettings, cmdPrefix: string, checked: boolean) => {
    setForm(prev => prev ? { ...prev, [key]: checked } : null);
    onSend(`${cmdPrefix}:${checked ? 1 : 0}`);
  };

  const handleSelectChange = (key: keyof ReceiverSettings, cmdPrefix: string, value: string) => {
    const numVal = parseInt(value);
    const finalVal = isNaN(numVal) ? value : numVal;
    setForm(prev => prev ? { ...prev, [key]: finalVal } : null);
    onSend(`${cmdPrefix}:${value}`);
  };

  const handleInputChange = (key: keyof ReceiverSettings, value: string) => {
    const numVal = parseInt(value);
    if (isNaN(numVal)) return;
    setForm(prev => prev ? { ...prev, [key]: numVal } : null);
  };

  const handleInputBlur = (cmdPrefix: string, value: number | undefined) => {
    if (value === undefined) return;
    onSend(`${cmdPrefix}:${value}`);
  };

  const steeringCh = form?.steeringChannel ?? 1;
  const throttleCh = form?.throttleChannel ?? 2;
  const channels = data?.channels || Array(16).fill(1500);
  const steering = channels[steeringCh - 1] || 1500;
  const throttle = channels[throttleCh - 1] || 1500;
  const isLoaded = !!form;

  const CenterBar = ({ label, value, leftLabel, rightLabel, colorClass }: {
    label: string; value: number; leftLabel: string; rightLabel: string; colorClass: string;
  }) => {
    const pct = ((value - 1000) / 1000) * 100;
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{leftLabel}</span>
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{rightLabel}</span>
        </div>
        <div className="relative h-8 bg-[hsl(0,0%,8%)] rounded-lg overflow-hidden border border-border/30">
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-foreground/15 z-10" />
          <div
            className={`absolute top-1 bottom-1 ${colorClass} rounded-sm transition-all duration-75 ease-out`}
            style={{
              left: value < 1500 ? `${pct}%` : '50%',
              right: value > 1500 ? `${100 - pct}%` : '50%',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-foreground z-20 drop-shadow-md">
            {value}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        
        {/* LEFT: Channel Monitor */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Gamepad2 size={14} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">RC Control Monitor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${data ? 'bg-[hsl(var(--sensor-ok))] animate-pulse' : 'bg-muted-foreground'}`} />
              <span className="text-[10px] text-muted-foreground font-mono">{data ? 'LIVE' : 'NO SIGNAL'}</span>
            </div>
          </div>

          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            <CenterBar label="Steering" value={steering} leftLabel="Left" rightLabel="Right" colorClass="bg-blue-500" />
            <CenterBar label="Throttle" value={throttle} leftLabel="Brake/Rev" rightLabel="Forward" colorClass={throttle > 1500 ? "bg-[hsl(var(--sensor-ok))]" : "bg-destructive"} />

            <div className="border-t border-border/20 pt-4">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">AUX Channels</span>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {channels.slice(4).map((val: number, idx: number) => {
                  const pct = Math.max(0, Math.min(100, ((val - 1000) / 1000) * 100));
                  return (
                    <div key={`aux-${idx}`} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-10 font-mono">AUX{idx + 1}</span>
                      <div className="flex-1 h-2 bg-[hsl(0,0%,8%)] rounded-full overflow-hidden border border-border/10">
                        <div className="h-full bg-muted-foreground/50 rounded-full transition-all duration-75" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground w-9 text-right">{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Stats + Settings */}
        <div className="space-y-4">
          {/* Link Statistics */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
              <Signal size={14} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">Link Statistics</span>
            </div>
            <div className="p-2.5 space-y-1.5">
              <StatCard icon={Activity} label="Link Quality" value={data ? `${data.uplinkLQ}` : "—"} unit="%" accent />
              <StatCard icon={Antenna} label="RSSI" value={data ? `${data.uplinkRSS1}` : "—"} unit="dBm" />
              <StatCard icon={Zap} label="TX Power" value={data ? `${data.uplinkTXPower}` : "—"} unit="mW" />
              <StatCard icon={Signal} label="SNR" value={data ? `${data.uplinkSNR}` : "—"} unit="dB" />
            </div>
          </div>

          {/* Car Settings */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Radio size={14} className="text-primary" />
                <span className="text-xs font-semibold text-foreground">Car Settings</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onSend("RX_SETTINGS")}>
                <RefreshCw size={12} />
              </Button>
            </div>
            
            <div className="p-4 space-y-3.5 text-xs">
              {/* Steering */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Steering</Label>
                <div className="flex items-center gap-2">
                  <Select value={steeringCh.toString()} onValueChange={(v) => handleSelectChange("steeringChannel", "SET_STEER_CH", v)} disabled={!isLoaded}>
                    <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 16 }).map((_, i) => (
                        <SelectItem key={i} value={(i + 1).toString()}>CH {i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1 border border-border rounded-md px-2 h-7">
                    <Label className="text-[10px] text-muted-foreground">REV</Label>
                    <Switch className="scale-75 origin-right" checked={form?.steeringRev ?? false} onCheckedChange={(v) => handleSwitchChange("steeringRev", "SET_STEER_REV", v)} disabled={!isLoaded} />
                  </div>
                </div>
              </div>

              {/* Throttle */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Throttle</Label>
                <div className="flex items-center gap-2">
                  <Select value={throttleCh.toString()} onValueChange={(v) => handleSelectChange("throttleChannel", "SET_THR_CH", v)} disabled={!isLoaded}>
                    <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 16 }).map((_, i) => (
                        <SelectItem key={i} value={(i + 1).toString()}>CH {i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1 border border-border rounded-md px-2 h-7">
                    <Label className="text-[10px] text-muted-foreground">REV</Label>
                    <Switch className="scale-75 origin-right" checked={form?.throttleRev ?? false} onCheckedChange={(v) => handleSwitchChange("throttleRev", "SET_THR_REV", v)} disabled={!isLoaded} />
                  </div>
                </div>
              </div>

              {/* RC Ranges */}
              <div className="border-t border-border/20 pt-3">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">RC Range (µs)</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[9px] text-muted-foreground">Min</Label>
                    <Input type="number" className="h-7 text-xs font-mono" value={form?.rcMin ?? 1000} onChange={(e) => handleInputChange("rcMin", e.target.value)} onBlur={() => handleInputBlur("SET_RC_MIN", form?.rcMin)} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[9px] text-muted-foreground">Mid</Label>
                    <Input type="number" className="h-7 text-xs font-mono" value={form?.rcMid ?? 1500} onChange={(e) => handleInputChange("rcMid", e.target.value)} onBlur={() => handleInputBlur("SET_RC_MID", form?.rcMid)} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[9px] text-muted-foreground">Max</Label>
                    <Input type="number" className="h-7 text-xs font-mono" value={form?.rcMax ?? 2000} onChange={(e) => handleInputChange("rcMax", e.target.value)} onBlur={() => handleInputBlur("SET_RC_MAX", form?.rcMax)} />
                  </div>
                </div>
              </div>

              {/* Smoothing */}
              <div className="border-t border-border/20 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">RC Smoothing</Label>
                  <Switch checked={form?.rcSmoothing ?? false} onCheckedChange={(v) => handleSwitchChange("rcSmoothing", "SET_RC_SMOOTH", v)} disabled={!isLoaded} />
                </div>
                {form?.rcSmoothing && (
                  <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                    <Label className="text-xs text-muted-foreground">Factor</Label>
                    <Input type="number" className="h-7 w-20 text-xs font-mono" value={form?.rcSmoothingCoeff ?? 30} onChange={(e) => handleInputChange("rcSmoothingCoeff", e.target.value)} onBlur={() => handleInputBlur("SET_RC_SMOOTH_COEFF", form?.rcSmoothingCoeff)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiverPage;
