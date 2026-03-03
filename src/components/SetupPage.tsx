import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Cpu, RefreshCw, Trash2, Battery, Signal, Gauge, Download, Upload, ShieldAlert, Car } from "lucide-react";
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

interface SetupPageProps {
  uartConfigs: any[];
  onSend: (cmd: string) => Promise<void> | void;
  onReboot: () => Promise<void> | void;
}

const InfoRow = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-border/10 last:border-0">
    <span className="text-muted-foreground text-xs">{label}</span>
    <span className={`font-mono text-xs ${valueColor || "text-foreground"}`}>{value}</span>
  </div>
);

const SetupPage = ({ uartConfigs, onSend, onReboot }: SetupPageProps) => {
  return (
    <div className="flex flex-col h-full gap-5 overflow-y-auto">
      {/* Top row: System actions + Backup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      {/* Bottom row: Car visualization + Info panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Car visualization placeholder */}
        <div className="md:col-span-2 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
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
              <InfoRow label="3D Fix" value="False" valueColor="text-destructive" />
              <InfoRow label="Satellites" value="0" />
              <InfoRow label="DOP" value="—" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
