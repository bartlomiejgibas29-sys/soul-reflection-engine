import { Card } from "@/components/ui/card";
import { useEffect } from "react";
import type { ReceiverData } from "@/hooks/useSerial";

interface ReceiverPageProps {
  data: ReceiverData | null;
  onSend: (data: string) => Promise<void> | void;
}

const ChannelBar = ({ label, value, colorClass }: { label: string; value: number; colorClass: string }) => {
  const percentage = Math.max(0, Math.min(100, ((value - 1000) / 1000) * 100));
  
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-right font-mono text-xs text-muted-foreground shrink-0">{label}</div>
      <div className="flex-1 h-5 bg-secondary/60 rounded overflow-hidden relative">
        <div 
          className={`h-full transition-all duration-75 ease-out rounded ${colorClass}`} 
          style={{ width: `${percentage}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground drop-shadow-md font-mono">
          {value}
        </div>
      </div>
    </div>
  );
};

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-border/20 last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="font-mono text-xs text-foreground">{value}</span>
  </div>
);

const ReceiverPage = ({ data, onSend }: ReceiverPageProps) => {
  useEffect(() => {
    onSend("ENABLE_RECEIVER_MODE");
    return () => {
      onSend("DISABLE_RECEIVER_MODE");
    };
  }, []);

  const channels = data?.channels || Array(16).fill(1500);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Info banner */}
      <div className="bg-primary/10 border border-primary/20 px-4 py-2.5 rounded-lg text-xs text-primary/90 flex items-center gap-2">
        <span className="text-primary text-base">⚡</span>
        <span>Ensure your receiver is bound and powered on. Bars show real-time ExpressLRS channel data.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Channels */}
        <Card className="lg:col-span-2 p-4 bg-card border-border overflow-y-auto">
          <h3 className="font-semibold text-sm mb-3 text-foreground">Receiver Channels</h3>
          <div className="space-y-1.5">
            <ChannelBar label="Roll [A]" value={channels[0]} colorClass="bg-[hsl(0,70%,50%)]" />
            <ChannelBar label="Pitch [E]" value={channels[1]} colorClass="bg-[hsl(270,60%,55%)]" />
            <ChannelBar label="Yaw [R]" value={channels[2]} colorClass="bg-[hsl(210,70%,50%)]" />
            <ChannelBar label="Throttle [T]" value={channels[3]} colorClass="bg-[hsl(30,90%,50%)]" />
            
            <div className="my-3 border-t border-border/30" />
            
            {channels.slice(4).map((val, idx) => (
              <ChannelBar 
                key={`aux-${idx}`} 
                label={`AUX ${idx + 1}`} 
                value={val} 
                colorClass="bg-[hsl(160,50%,40%)]" 
              />
            ))}
          </div>
        </Card>

        {/* Stats */}
        <div className="space-y-4">
          <Card className="p-4 bg-card border-border">
            <h3 className="font-semibold text-sm mb-3 text-foreground">Link Statistics</h3>
            <div>
              <StatRow label="RSSI (dBm)" value={data ? `${data.uplinkRSS1}` : "—"} />
              <StatRow label="Link Quality" value={data ? `${data.uplinkLQ}%` : "—"} />
              <StatRow label="SNR" value={data ? `${data.uplinkSNR}` : "—"} />
              <StatRow label="TX Power" value={data ? `${data.uplinkTXPower} mW` : "—"} />
              <StatRow label="RF Mode" value={data ? `${data.rfMode}` : "—"} />
              <StatRow label="DL RSSI" value={data ? `${data.downlinkRSSI}` : "—"} />
              <StatRow label="DL LQ" value={data ? `${data.downlinkLQ}%` : "—"} />
            </div>
          </Card>

          <Card className="p-4 bg-card border-border flex flex-col items-center justify-center min-h-[160px]">
            <div className="text-center text-muted-foreground">
              <div className="mb-2 text-3xl">✈️</div>
              <p className="text-xs">3D Model Preview</p>
              <p className="text-[10px] opacity-40 mt-1">Coming Soon</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReceiverPage;
