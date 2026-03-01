import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { useEffect } from "react";
import type { ReceiverData } from "@/hooks/useSerial";

interface ReceiverPageProps {
  data: ReceiverData | null;
  onSend: (data: string) => Promise<void> | void;
}

const ChannelBar = ({ label, value, colorClass }: { label: string; value: number; colorClass: string }) => {
  // Map value 1000-2000 to 0-100%
  // 1000 = 0%, 1500 = 50%, 2000 = 100%
  const percentage = Math.max(0, Math.min(100, ((value - 1000) / 1000) * 100));
  
  return (
    <div className="flex items-center gap-4 mb-2">
      <div className="w-24 text-right font-mono text-sm text-muted-foreground">{label}</div>
      <div className="flex-1 h-6 bg-secondary rounded-sm overflow-hidden relative">
        <div 
            className={`h-full transition-all duration-75 ease-out ${colorClass}`} 
            style={{ width: `${percentage}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
            {value}
        </div>
      </div>
    </div>
  );
};

const ReceiverPage = ({ data, onSend }: ReceiverPageProps) => {
  // Enable receiver mode on mount, disable on unmount
  useEffect(() => {
    onSend("ENABLE_RECEIVER_MODE");
    return () => {
      onSend("DISABLE_RECEIVER_MODE");
    };
  }, []);

  const channels = data?.channels || Array(16).fill(1500); // Default to center if no data

  // Colors matching Betaflight somewhat (Red, Purple, Blue, Cyan/Orange)
  // Tailwind classes for colors
  const ROLL_COLOR = "bg-red-500";
  const PITCH_COLOR = "bg-purple-500";
  const YAW_COLOR = "bg-blue-500";
  const THROTTLE_COLOR = "bg-orange-500";
  const AUX_COLOR = "bg-emerald-600";

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-md text-sm text-yellow-200/80">
        <strong>Important:</strong> Ensure your receiver is bound and powered on. The bars below show real-time channel data from ExpressLRS.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left Column: Channels */}
        <div className="lg:col-span-2 overflow-y-auto pr-2">
            <Card className="p-6 bg-card border-border">
                <h3 className="font-bold mb-4 text-lg">Receiver Channels</h3>
                
                <div className="space-y-1">
                    <ChannelBar label="Roll [A]" value={channels[0]} colorClass={ROLL_COLOR} />
                    <ChannelBar label="Pitch [E]" value={channels[1]} colorClass={PITCH_COLOR} />
                    <ChannelBar label="Yaw [R]" value={channels[2]} colorClass={YAW_COLOR} />
                    <ChannelBar label="Throttle [T]" value={channels[3]} colorClass={THROTTLE_COLOR} />
                    
                    <div className="my-4 border-t border-border/50" />
                    
                    {channels.slice(4).map((val, idx) => (
                        <ChannelBar 
                            key={`aux-${idx}`} 
                            label={`AUX ${idx + 1}`} 
                            value={val} 
                            colorClass={AUX_COLOR} 
                        />
                    ))}
                </div>
            </Card>
        </div>

        {/* Right Column: Stats & Model */}
        <div className="space-y-6">
            <Card className="p-6 bg-card border-border">
                <h3 className="font-bold mb-4 text-lg">Link Statistics</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-border/30 pb-1">
                        <span className="text-muted-foreground">RSSI (dBm)</span>
                        <span className="font-mono">{data ? `-${data.uplinkRSS1}` : "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/30 pb-1">
                        <span className="text-muted-foreground">Link Quality</span>
                        <span className="font-mono">{data ? `${data.uplinkLQ}%` : "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/30 pb-1">
                        <span className="text-muted-foreground">SNR</span>
                        <span className="font-mono">{data ? data.uplinkSNR : "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/30 pb-1">
                        <span className="text-muted-foreground">TX Power</span>
                        <span className="font-mono">{data ? `${data.uplinkTXPower} mW` : "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/30 pb-1">
                        <span className="text-muted-foreground">RF Mode</span>
                        <span className="font-mono">{data ? data.rfMode : "N/A"}</span>
                    </div>
                </div>
            </Card>

            <Card className="p-6 bg-card border-border flex flex-col items-center justify-center min-h-[200px] bg-muted/10">
                <div className="text-center text-muted-foreground">
                    <div className="mb-2 text-4xl">✈️</div>
                    <p>3D Model Preview</p>
                    <p className="text-xs opacity-50">(Coming Soon)</p>
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default ReceiverPage;
