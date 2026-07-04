import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Cpu, RefreshCw, Trash2, Battery, Signal, Gauge, Download, Upload, ShieldAlert, Car, Satellite } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { GpsData, ModuleStates } from "@/hooks/useSerial";

interface SetupPageProps {
  uartConfigs: any[];
  gpsData?: GpsData | null;
  moduleStates?: ModuleStates;
  onSend: (cmd: string) => Promise<void> | void;
  onReboot: () => Promise<void> | void;
}

const InfoRow = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-border/10 last:border-0">
    <span className="text-muted-foreground text-xs">{label}</span>
    <span className={`font-mono text-xs ${valueColor || "text-foreground"}`}>{value}</span>
  </div>
);

const SetupPage = ({ uartConfigs, gpsData, moduleStates, onSend, onReboot }: SetupPageProps) => {
  useEffect(() => {
    onSend("MODULE_STATUS");
    const t = setTimeout(() => onSend("GPS_SETTINGS"), 300);
    return () => {
      clearTimeout(t);
    };
  }, []);

  const handleGpsToggle = (enabled: boolean) => {
    const command = enabled ? "SET_GPS_MODULE:1" : "SET_GPS_MODULE:0";
    void Promise.resolve(onSend(command));
  };
  return (
    <div className="flex flex-col h-full gap-5 overflow-y-auto pb-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/40 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.10),_transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary/80">BetaDrive</p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">Setup</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Centralny panel systemu, modułów i podstawowych statusów pojazdu.
            </p>
          </div>
        </div>
      </div>

      {/* Top row: System actions + Backup + Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* System Actions */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <Cpu size={14} className="text-primary" />
            <span className="text-xs font-semibold text-foreground">System Actions</span>
          </div>
          <div className="p-4 space-y-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full justify-start text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-2">
                  <RefreshCw size={13} />
                  Save & Reboot
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Save & Reboot</AlertDialogTitle>
                  <AlertDialogDescription>
                    Configuration will be saved and the device will restart. Make sure all settings are correct.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onReboot()}>Confirm</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-xs h-9 text-destructive border-destructive/30 hover:bg-destructive/10 gap-2">
                  <ShieldAlert size={13} />
                  Factory Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Factory Reset</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will erase all configuration and restore factory defaults. This action cannot be undone!
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onSend("HARD RESET")}>
                    Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Backup / Restore */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <Download size={14} className="text-primary" />
            <span className="text-xs font-semibold text-foreground">Backup & Restore</span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Backup</span> your configuration in case of an accident. CLI settings are <span className="text-destructive font-semibold">not</span> included.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-xs gap-2 font-semibold" disabled>
                <Download size={13} /> Backup
              </Button>
              <Button variant="outline" className="flex-1 h-9 text-xs gap-2 font-semibold" disabled>
                <Upload size={13} /> Restore
              </Button>
            </div>
          </div>
        </div>

        {/* Modules */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <Satellite size={14} className="text-primary" />
            <span className="text-xs font-semibold text-foreground">Modules</span>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Satellite size={16} className="text-foreground/70" />
                <Label htmlFor="gps-module" className="text-sm font-medium text-foreground">
                  GPS
                </Label>
              </div>
              <Switch
                id="gps-module"
                checked={moduleStates?.gps ?? true}
                onCheckedChange={handleGpsToggle}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Car visualization + Info panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Car visualization placeholder */}
        <div className="md:col-span-2 rounded-2xl border border-border/40 bg-background/40 shadow-[0_10px_30px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <Car size={14} className="text-primary" />
            <span className="text-xs font-semibold text-foreground">Vehicle Overview</span>
          </div>
          <div className="flex-1 flex items-center justify-center bg-[hsl(0,0%,10%)]">
            <div className="text-center space-y-2">
              <Car size={48} className="text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">3D Model Visualization</p>
              <p className="text-[10px] text-muted-foreground/60">Coming soon</p>
            </div>
          </div>
        </div>

        {/* Info panels */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
              <Gauge size={14} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">Telemetry</span>
            </div>
            <div className="p-4">
              <InfoRow label="Battery voltage" value="0.00 V" />
              <InfoRow label="RSSI" value="0%" />
              <InfoRow label="Link Quality" value="—" />
              <InfoRow label="UART Ports" value={`${uartConfigs.filter(c => c.enabled).length} / ${uartConfigs.length}`} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
              <Signal size={14} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">GPS Status</span>
            </div>
            <div className="p-4">
              <InfoRow
                label="3D Fix"
                value={gpsData?.fix ? "True" : "False"}
                valueColor={gpsData?.fix ? "text-[hsl(var(--sensor-ok))]" : "text-destructive"}
              />
              <InfoRow label="Satellites" value={`${gpsData?.numSatellites ?? 0}`} />
              <InfoRow label="DOP" value={gpsData && gpsData.dop > 0 ? gpsData.dop.toFixed(2) : "—"} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
