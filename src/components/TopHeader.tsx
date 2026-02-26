import { Wifi, AlertTriangle, Link, Settings } from "lucide-react";

const sensors = [
  { name: "Gyro", active: false },
  { name: "Accel", active: true },
  { name: "Mag", active: false },
  { name: "Baro", active: false },
  { name: "GPS", active: false },
  { name: "Sonar", active: false },
];

const TopHeader = () => {
  return (
    <header className="flex items-center justify-between bg-header px-4 py-2 border-b border-border">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div className="text-primary font-bold text-2xl tracking-wider italic">
          BETAFLIGHT
        </div>
        <div className="text-xs text-muted-foreground leading-tight">
          <div>Configurator: 10.7.0</div>
          <div>Firmware: BTFL 4.2.5</div>
          <div>Target: FFPV/FF_RACEPIT(STM32F405)</div>
        </div>
      </div>

      {/* Center: Voltage + Sensors */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <div className="w-8 h-4 border border-muted-foreground rounded-sm relative">
            <div className="absolute inset-0.5 bg-muted-foreground/30 rounded-sm" />
          </div>
          <span>0.06V (USB)</span>
        </div>

        <div className="flex items-center gap-1 text-muted-foreground">
          <AlertTriangle size={14} />
          <Wifi size={14} />
          <Link size={14} />
        </div>

        <div className="flex items-center gap-3">
          {sensors.map((s) => (
            <div key={s.name} className="flex flex-col items-center">
              <Settings size={18} className={s.active ? "text-primary" : "text-sensor-off"} />
              <span className={`text-[10px] ${s.active ? "text-primary" : "text-sensor-off"}`}>
                {s.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        <div className="text-xs text-muted-foreground">
          <div>Dataflash: free 16.0MB</div>
          <div className="w-32 h-2 bg-secondary rounded-full mt-1">
            <div className="h-full w-full bg-primary/40 rounded-full" />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1">
            <input type="checkbox" className="accent-primary w-3 h-3" />
            Enable Expert Mode
          </label>
        </div>

        <button className="flex flex-col items-center text-primary hover:text-primary/80 transition-colors">
          <Settings size={28} />
          <span className="text-[10px]">Update Firmware</span>
        </button>

        <button className="flex flex-col items-center text-destructive hover:text-destructive/80 transition-colors">
          <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center">
            <span className="text-destructive-foreground font-bold text-sm">✕</span>
          </div>
          <span className="text-[10px]">Disconnect</span>
        </button>
      </div>
    </header>
  );
};

export default TopHeader;
