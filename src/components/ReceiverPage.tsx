import { useEffect } from "react";
import type { ReceiverData } from "@/hooks/useSerial";
import { Radio, Signal, Zap, Antenna, Activity } from "lucide-react";

interface ReceiverPageProps {
  data: ReceiverData | null;
  onSend: (data: string) => Promise<void> | void;
}

const ChannelBar = ({ label, value, color, accent }: { label: string; value: number; color: string; accent?: boolean }) => {
  const percentage = Math.max(0, Math.min(100, ((value - 1000) / 1000) * 100));
  const center = 50;
  const barLeft = Math.min(percentage, center);
  const barWidth = Math.abs(percentage - center);

  return (
    <div className="flex items-center gap-3">
      <div className={`w-[80px] text-right font-mono text-xs shrink-0 ${accent ? 'text-foreground font-bold' : 'text-muted-foreground font-medium'}`}>
        {label}
      </div>
      <div className="flex-1 h-7 bg-[hsl(0,0%,10%)] rounded-md overflow-hidden relative border border-border/40">
        {/* Center line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border/50 z-10" />
        {/* Bar from center */}
        <div
          className={`absolute top-0.5 bottom-0.5 transition-all duration-75 ease-out rounded ${color}`}
          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-foreground font-mono z-20 drop-shadow-sm">
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

const ReceiverPage = ({ data, onSend }: ReceiverPageProps) => {
  useEffect(() => {
    onSend("ENABLE_RECEIVER_MODE");
    return () => { onSend("DISABLE_RECEIVER_MODE"); };
  }, []);

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
      {/* Top stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-card border border-border rounded-lg p-3 flex flex-col items-center justify-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Link Quality</div>
          <LqBadge value={data ? data.uplinkLQ : null} />
        </div>
        <div className="bg-card border border-border rounded-lg p-3 flex flex-col items-center justify-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">RSSI</div>
          <span className="font-mono text-2xl font-bold text-foreground">
            {data ? data.uplinkRSS1 : "—"}
            <span className="text-xs text-muted-foreground ml-0.5">dBm</span>
          </span>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 flex flex-col items-center justify-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">SNR</div>
          <span className="font-mono text-2xl font-bold text-foreground">
            {data ? data.uplinkSNR : "—"}
            <span className="text-xs text-muted-foreground ml-0.5">dB</span>
          </span>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 flex flex-col items-center justify-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">TX Power</div>
          <span className="font-mono text-2xl font-bold text-primary">
            {data ? data.uplinkTXPower : "—"}
            <span className="text-xs text-muted-foreground ml-0.5">mW</span>
          </span>
        </div>
      </div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-2">
              <ChannelBar label="Roll [A]" value={channels[0]} color={COLORS.roll} accent />
              <ChannelBar label="Pitch [E]" value={channels[1]} color={COLORS.pitch} accent />
              <ChannelBar label="Yaw [R]" value={channels[2]} color={COLORS.yaw} accent />
              <ChannelBar label="Throt [T]" value={channels[3]} color={COLORS.throttle} accent />
            </div>

            <div className="border-t border-border/20 my-3" />

            {/* AUX channels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-2">
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
        </div>
      </div>
    </div>
  );
};

export default ReceiverPage;
