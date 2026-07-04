import { useState, useEffect } from "react";
import { Cpu, RefreshCw, AlertTriangle, Lightbulb, Activity, Ban, Save, Battery, Gauge, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { UartConfig, PinConfig, MotorConfig } from "@/hooks/useSerial";
import { getPinReservationState } from "@/lib/pinReservations";

// Definicja pinów dla ESP32-C3
const AVAILABLE_PINS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 21];
const RESERVED_USB_PINS = [20, 21];

interface PinsPageProps {
  uartConfigs: UartConfig[];
  pinConfigs: PinConfig[];
  motorConfig: MotorConfig | null;
  onSend: (data: string) => Promise<void> | void;
}

const PinsPage = ({ uartConfigs, pinConfigs, motorConfig, onSend }: PinsPageProps) => {
  const [localConfigs, setLocalConfigs] = useState<Record<number, PinConfig>>({});
  const [pendingChanges, setPendingChanges] = useState<Record<number, string>>({});

  // Synchronizacja lokalnego stanu z propsami
  useEffect(() => {
    const configMap: Record<number, PinConfig> = {};
    pinConfigs.forEach(p => {
      configMap[p.pin] = p;
    });
    setLocalConfigs(configMap);
    // Reset pending changes when remote config arrives
    setPendingChanges({});
  }, [pinConfigs]);

  // Pobranie aktualnej konfiguracji przy montowaniu
  useEffect(() => {
    onSend("PIN_TABLE");
    onSend("MOTOR_PINS");
    
    // Włącz tryb odbiornika, aby sterowanie działało w tle
    onSend("ENABLE_RECEIVER_MODE");
  }, []);

  const handleModeChange = (pin: number, mode: string) => {
    setPendingChanges(prev => ({ ...prev, [pin]: mode }));
  };

  const handleSave = (pin: number) => {
    const mode = pendingChanges[pin];
    if (!mode) return;

    // Check if STEERING is already assigned to another pin
    if (mode === "STEERING") {
      const existingSteering = pinConfigs.find(p => p.mode === "STEERING" && p.pin !== pin)
        ?? Object.values(localConfigs).find(p => p?.mode === "STEERING" && p.pin !== pin);
      if (existingSteering) {
        console.warn(`Steering is already assigned to pin ${existingSteering.pin}. Reassigning.`);
        onSend(`SET_PIN_MODE:${existingSteering.pin}:DISABLED`);
      }
    }
    onSend(`SET_PIN_MODE:${pin}:${mode}`);
    // Clear pending change for this pin
    setPendingChanges(prev => {
      const next = { ...prev };
      delete next[pin];
      return next;
    });
  };

  const handleSaveAll = () => {
    Object.entries(pendingChanges).forEach(([pin, mode]) => {
      if (mode === "STEERING") {
        const existingSteering = pinConfigs.find(p => p.mode === "STEERING" && p.pin !== Number(pin));
        if (existingSteering) {
          onSend(`SET_PIN_MODE:${existingSteering.pin}:DISABLED`);
        }
      }
      onSend(`SET_PIN_MODE:${pin}:${mode}`);
    });
    setPendingChanges({});
  };

  const getPinStatus = (pin: number) => {
    return getPinReservationState({
      pin,
      uartConfigs,
      pinConfigs,
      motorConfig,
      reservedUsbPins: RESERVED_USB_PINS,
    });
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 relative">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/40 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.10),_transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary/80">BetaDrive</p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">Pins</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Przypisywanie funkcji do pinów GPIO i kontrola konfliktów z UART oraz motorem.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onSend("PIN_TABLE")} className="border-border/50 bg-background/70">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AVAILABLE_PINS.map(pin => {
          const status = getPinStatus(pin);
          const currentConfig = localConfigs[pin] || { pin, mode: "DISABLED" };
          const pendingMode = pendingChanges[pin];
          const displayMode = pendingMode || currentConfig.mode;
          const hasChange = !!pendingMode;
          
          return (
            <Card key={pin} className={`p-4 border ${status.locked ? 'bg-muted/50 border-muted' : hasChange ? 'border-primary/50 bg-primary/5' : 'border-border/40 bg-background/40 shadow-[0_10px_30px_rgba(0,0,0,0.15)]'}`}>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">GPIO {pin}</Badge>
                    {status.locked && (
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertTriangle size={14} className="text-amber-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{status.reason}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {!status.locked && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {displayMode === "LIGHT" && <Lightbulb size={14} className="text-yellow-500" />}
                        {displayMode === "SERVO" && <Activity size={14} className="text-blue-500" />}
                        {displayMode === "STEERING" && <Gauge size={14} className="text-purple-500" />}
                        {displayMode === "BATTERY" && <Battery size={14} className="text-green-500" />}
                        {displayMode === "MOTOR" && <Zap size={14} className="text-orange-400" />}
                        {displayMode === "DISABLED" && <Ban size={14} className="text-muted-foreground" />}
                      </div>
                      {hasChange && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => handleSave(pin)}
                        >
                          <Save size={14} />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {status.locked ? (
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded border border-border">
                    {status.reason}
                  </div>
                ) : (
                  <Select 
                    value={displayMode} 
                    onValueChange={(val) => handleModeChange(pin, val)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DISABLED">Disabled</SelectItem>
                      <SelectItem value="LIGHT">Light Output</SelectItem>
                      <SelectItem value="SERVO">Servo Output</SelectItem>
                      <SelectItem value="STEERING">Steering</SelectItem>
                      <SelectItem value="BATTERY">Battery Input</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {Object.keys(pendingChanges).length > 0 && (
        <Button
          onClick={handleSaveAll}
          className="fixed bottom-6 right-6 z-50 bg-foreground text-background hover:bg-foreground/90 rounded-md px-5 py-2.5 shadow-lg flex items-center gap-2 font-semibold tracking-wider text-sm"
        >
          <Save className="h-4 w-4" />
          SAVE
        </Button>
      )}
    </div>
  );
};

export default PinsPage;
