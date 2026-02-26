import { Usb, Unplug } from "lucide-react";
import { useState, useCallback } from "react";

interface TopHeaderProps {
  connected: boolean;
  deviceInfo: { configurator?: string; firmware?: string; target?: string } | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

const TopHeader = ({ connected, deviceInfo, onConnect, onDisconnect }: TopHeaderProps) => {
  return (
    <header className="flex items-center justify-between bg-header px-4 py-2 border-b border-border">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div className="text-primary font-bold text-2xl tracking-wider italic">
          RC-Config
        </div>
        {connected && deviceInfo && (
          <div className="text-xs text-muted-foreground leading-tight">
            {deviceInfo.configurator && <div>Configurator: {deviceInfo.configurator}</div>}
            {deviceInfo.firmware && <div>Firmware: {deviceInfo.firmware}</div>}
            {deviceInfo.target && <div>Target: {deviceInfo.target}</div>}
          </div>
        )}
        {!connected && (
          <div className="text-xs text-muted-foreground">Nie połączono</div>
        )}
      </div>

      {/* Right: Connect/Disconnect */}
      <div className="flex items-center gap-4">
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
            onClick={onConnect}
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
