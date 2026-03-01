import { useEffect, useState } from "react";
import type { ReceiverData, ReceiverSettings } from "@/hooks/useSerial";
import { Radio, Signal, Zap, Antenna, Activity } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface ReceiverPageProps {
  data: ReceiverData | null;
  onSend: (data: string) => Promise<void> | void;
  settings?: ReceiverSettings | null;
}

const ChannelBar = ({ label, value, color, accent }: { label: string; value: number; color: string; accent?: boolean }) => {
  const percentage = Math.max(0, Math.min(100, ((value - 1000) / 1000) * 100));

  return (
    <div className="flex items-center gap-3">
      <div className={`w-[80px] text-right font-mono text-xs shrink-0 ${accent ? 'text-foreground font-bold' : 'text-muted-foreground font-medium'}`}>
        {label}
      </div>
      <div className="flex-1 h-7 bg-[hsl(0,0%,10%)] rounded-md overflow-hidden relative border border-border/40">
        {/* Bar from left */}
        <div
          className={`absolute top-0.5 bottom-0.5 left-0 transition-all duration-75 ease-out rounded-sm ${color}`}
          style={{ width: `${percentage}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-foreground font-mono z-20 drop-shadow-sm mix-blend-difference">
          {value}
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ icon: Icon, label, value, unit, color }: {
  icon?: any; label: string; value: string; unit?: string; color?: string;
}) => (
  <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-[hsl(0,0%,10%)] border border-border/20">
    {Icon && <Icon size={13} className={color || "text-muted-foreground"} />}
    <div className="flex-1">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
    <div className="text-right">
      <span className="font-mono text-sm text-foreground font-semibold">{value}</span>
      {unit && <span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span>}
    </div>
  </div>
);

const LqBadge = ({ value }: { value: number | null }) => {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = value >= 80 ? "text-[hsl(120,60%,50%)]" : value >= 50 ? "text-primary" : "text-destructive";
  return <span className={`font-mono text-2xl font-bold ${color}`}>{value}<span className="text-xs">%</span></span>;
};

const ReceiverPage = ({ data, onSend, settings }: ReceiverPageProps) => {
  useEffect(() => {
    onSend("ENABLE_RECEIVER_MODE");
    return () => { onSend("DISABLE_RECEIVER_MODE"); };
  }, []);
  useEffect(() => { onSend("RX_SETTINGS"); }, []);
  
  const [local, setLocal] = useState<ReceiverSettings | null>(null);
  useEffect(() => { if (settings) setLocal(settings); }, [settings]);

  const channels = data?.channels || Array(16).fill(1500);

  const COLORS = {
    roll: "bg-[hsl(0,65%,50%)]",
    pitch: "bg-[hsl(265,55%,55%)]",
    yaw: "bg-[hsl(210,65%,50%)]",
    throttle: "bg-primary",
    aux: "bg-[hsl(160,40%,38%)]",
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto">
      {/* Usunięto górny pasek statystyk zgodnie z prośbą */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Channels panel */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">Channel Monitor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${data ? 'bg-[hsl(120,60%,50%)] animate-pulse' : 'bg-muted-foreground'}`} />
              <span className="text-[10px] text-muted-foreground">{data ? 'LIVE' : 'NO DATA'}</span>
            </div>
          </div>

          <div className="p-4 space-y-2 overflow-y-auto flex-1">
            {/* Primary axes */}
            <div className="flex flex-col gap-2">
              <ChannelBar label="Roll [A]" value={channels[0]} color={COLORS.roll} accent />
              <ChannelBar label="Pitch [E]" value={channels[1]} color={COLORS.pitch} accent />
              <ChannelBar label="Yaw [R]" value={channels[2]} color={COLORS.yaw} accent />
              <ChannelBar label="Throt [T]" value={channels[3]} color={COLORS.throttle} accent />
            </div>

            <div className="border-t border-border/20 my-3" />

            {/* AUX channels */}
            <div className="flex flex-col gap-2">
              {channels.slice(4).map((val, idx) => (
                <ChannelBar
                  key={`aux-${idx}`}
                  label={`AUX ${idx + 1}`}
                  value={val}
                  color={COLORS.aux}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-3">
          {/* Uplink stats */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <Signal size={13} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">Uplink</span>
            </div>
            <div className="p-2 space-y-1.5">
              <StatItem icon={Antenna} label="RSSI 1" value={data ? `${data.uplinkRSS1}` : "—"} unit="dBm" />
              <StatItem icon={Antenna} label="RSSI 2" value={data ? `${data.uplinkRSS2}` : "—"} unit="dBm" />
              <StatItem icon={Activity} label="LQ" value={data ? `${data.uplinkLQ}` : "—"} unit="%" color="text-[hsl(120,60%,50%)]" />
              <StatItem label="SNR" value={data ? `${data.uplinkSNR}` : "—"} unit="dB" />
              <StatItem icon={Zap} label="TX Power" value={data ? `${data.uplinkTXPower}` : "—"} unit="mW" color="text-primary" />
              <StatItem label="RF Mode" value={data ? `${data.rfMode}` : "—"} />
              <StatItem label="Antenna" value={data ? `${data.activeAntenna}` : "—"} />
            </div>
          </div>

          {/* Downlink stats */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <Signal size={13} className="text-primary rotate-180" />
              <span className="text-xs font-semibold text-foreground">Downlink</span>
            </div>
            <div className="p-2 space-y-1.5">
              <StatItem icon={Antenna} label="RSSI" value={data ? `${data.downlinkRSSI}` : "—"} unit="dBm" />
              <StatItem icon={Activity} label="LQ" value={data ? `${data.downlinkLQ}` : "—"} unit="%" color="text-[hsl(120,60%,50%)]" />
              <StatItem label="SNR" value={data ? `${data.downlinkSNR}` : "—"} unit="dB" />
            </div>
          </div>

          {/* Receiver Settings */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <Radio size={13} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">Receiver Settings</span>
            </div>
            <div className="p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Telemetry</span>
                <Switch checked={!!local?.telemetry} onCheckedChange={(v) => { 
                    setLocal(prev => prev ? { ...prev, telemetry: v } : prev); 
                    onSend(`SET_TELEMETRY:${v ? 1 : 0}`); 
                }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">RSSI_ADC</span>
                <Switch checked={!!local?.rssiAdc} onCheckedChange={(v) => { 
                    setLocal(prev => prev ? { ...prev, rssiAdc: v } : prev); 
                    onSend(`SET_RSSI_ADC:${v ? 1 : 0}`); 
                }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">RSSI Channel</span>
                <Select value={(local?.rssiChannel ?? -1).toString()} onValueChange={(v) => { 
                    const val = parseInt(v);
                    setLocal(prev => prev ? { ...prev, rssiChannel: val } : prev); 
                    onSend(`SET_RSSI_CH:${val}`); 
                }}>
                  <SelectTrigger className="h-7 w-28 text-xs font-mono bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">Disabled</SelectItem>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SelectItem key={i} value={(i + 1).toString()}>AUX {i + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Channel Map</span>
                <Select value={local?.channelMap || "AETR1234"} onValueChange={(v) => { 
                    setLocal(prev => prev ? { ...prev, channelMap: v } : prev); 
                    onSend(`SET_CHMAP:${v}`); 
                }}>
                  <SelectTrigger className="h-7 w-32 text-xs font-mono bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["AETR1234","TAER1234","RETA1234","ETRA1234"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <span className="text-muted-foreground">RC Min</span>
                  <Input 
                    type="number" 
                    className="h-7 text-xs font-mono" 
                    value={local?.rcMin ?? 1000} 
                    onChange={(e) => { 
                        const v = parseInt(e.target.value); 
                        setLocal(prev => prev ? { ...prev, rcMin: v } : prev); 
                    }}
                    onBlur={(e) => {
                        const v = parseInt(e.target.value);
                        onSend(`SET_RC_MIN:${v}`);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">RC Mid</span>
                  <Input 
                    type="number" 
                    className="h-7 text-xs font-mono" 
                    value={local?.rcMid ?? 1500} 
                    onChange={(e) => { 
                        const v = parseInt(e.target.value); 
                        setLocal(prev => prev ? { ...prev, rcMid: v } : prev); 
                    }}
                    onBlur={(e) => {
                        const v = parseInt(e.target.value);
                        onSend(`SET_RC_MID:${v}`);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">RC Max</span>
                  <Input 
                    type="number" 
                    className="h-7 text-xs font-mono" 
                    value={local?.rcMax ?? 2000} 
                    onChange={(e) => { 
                        const v = parseInt(e.target.value); 
                        setLocal(prev => prev ? { ...prev, rcMax: v } : prev); 
                    }}
                    onBlur={(e) => {
                        const v = parseInt(e.target.value);
                        onSend(`SET_RC_MAX:${v}`);
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <span className="text-muted-foreground">RC Deadband</span>
                  <Input 
                    type="number" 
                    className="h-7 text-xs font-mono" 
                    value={local?.deadbandRc ?? 0} 
                    onChange={(e) => { 
                        const v = parseInt(e.target.value); 
                        setLocal(prev => prev ? { ...prev, deadbandRc: v } : prev); 
                    }}
                    onBlur={(e) => {
                        const v = parseInt(e.target.value);
                        onSend(`SET_DB_RC:${v}`);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Yaw Deadband</span>
                  <Input 
                    type="number" 
                    className="h-7 text-xs font-mono" 
                    value={local?.deadbandYaw ?? 0} 
                    onChange={(e) => { 
                        const v = parseInt(e.target.value); 
                        setLocal(prev => prev ? { ...prev, deadbandYaw: v } : prev); 
                    }}
                    onBlur={(e) => {
                        const v = parseInt(e.target.value);
                        onSend(`SET_DB_YAW:${v}`);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Thr 3D Deadband</span>
                  <Input 
                    type="number" 
                    className="h-7 text-xs font-mono" 
                    value={local?.deadbandThr3d ?? 0} 
                    onChange={(e) => { 
                        const v = parseInt(e.target.value); 
                        setLocal(prev => prev ? { ...prev, deadbandThr3d: v } : prev); 
                    }}
                    onBlur={(e) => {
                        const v = parseInt(e.target.value);
                        onSend(`SET_DB_THR3D:${v}`);
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">RC Smoothing</span>
                <Switch checked={!!local?.rcSmoothing} onCheckedChange={(v) => { 
                    setLocal(prev => prev ? { ...prev, rcSmoothing: v } : prev); 
                    onSend(`SET_RC_SMOOTH:${v ? 1 : 0}`); 
                }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Smooth Coeff</span>
                <Input 
                    type="number" 
                    className="h-7 text-xs font-mono w-20" 
                    value={local?.rcSmoothingCoeff ?? 30} 
                    onChange={(e) => { 
                        const v = parseInt(e.target.value); 
                        setLocal(prev => prev ? { ...prev, rcSmoothingCoeff: v } : prev); 
                    }}
                    onBlur={(e) => {
                        const v = parseInt(e.target.value);
                        onSend(`SET_RC_SMOOTH_COEFF:${v}`);
                    }}
                />
              </div>
              <div className="flex justify-end pt-1">
                <button onClick={() => onSend("RX_SETTINGS")} className="text-xs px-2 py-1 rounded bg-secondary text-foreground">Refresh</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiverPage;
