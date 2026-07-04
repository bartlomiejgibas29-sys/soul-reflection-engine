import { Usb, Unplug, Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface TopHeaderProps {
  connected: boolean;
  deviceInfo: { configurator?: string; firmware?: string; target?: string } | null;
  onConnect: (baudRate: number) => void;
  onDisconnect: () => void;
}

const TopHeader = ({ connected, deviceInfo, onConnect, onDisconnect }: TopHeaderProps) => {
  const [baudRate, setBaudRate] = useState("115200");
  const [autoConnect, setAutoConnect] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("autoConnectEnabled");
      setAutoConnect(saved === "true");
    } catch {}
  }, []);

  const toggleAuto = (v: boolean) => {
    setAutoConnect(v);
    try {
      localStorage.setItem("autoConnectEnabled", v ? "true" : "false");
    } catch {}
  };

  return (
    <header className="flex items-center justify-between bg-header px-4 py-2 border-b border-border">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-foreground font-black text-2xl tracking-tighter italic">
          <Rocket className="text-primary w-6 h-6" />
          <span>BETA<span className="text-primary">DRIVE</span></span>
        </div>
        {connected && deviceInfo && (
          <div className="text-xs text-muted-foreground leading-tight ml-2 border-l border-border pl-2">
            {deviceInfo.configurator && <div>Configurator: {deviceInfo.configurator}</div>}
            {deviceInfo.firmware && <div>Firmware: {deviceInfo.firmware}</div>}
            {deviceInfo.target && <div>Target: {deviceInfo.target}</div>}
          </div>
        )}
        {!connected && (
          <div className="text-xs text-muted-foreground">Not connected</div>
        )}
      </div>

      {/* Right: Connect/Disconnect */}
      <div className="flex items-center gap-4">
        {!connected && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Baud:</span>
              <Select value={baudRate} onValueChange={setBaudRate}>
                <SelectTrigger className="h-8 w-[100px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9600">9600</SelectItem>
                  <SelectItem value="57600">57600</SelectItem>
                  <SelectItem value="115200">115200</SelectItem>
                  <SelectItem value="230400">230400</SelectItem>
                  <SelectItem value="460800">460800</SelectItem>
                  <SelectItem value="921600">921600</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Auto  -  Connect</span>
              <Switch className="scale-75" checked={autoConnect} onCheckedChange={toggleAuto} />
            </div>
          </div>
        )}
        {connected ? (
          <button
            onClick={onDisconnect}
            className="flex flex-col items-center text-destructive hover:text-destructive/80 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center">
              <Unplug size={16} className="text-destructive-foreground" />
            </div>
            <span className="text-[10px]">Disconnect</span>
          </button>
        ) : (
          <button
            onClick={() => onConnect(parseInt(baudRate))}
            className="flex flex-col items-center text-primary hover:text-primary/80 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Usb size={16} className="text-primary-foreground" />
            </div>
            <span className="text-[10px]">Connect</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default TopHeader;
