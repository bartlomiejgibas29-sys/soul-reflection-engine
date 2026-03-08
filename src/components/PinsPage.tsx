import { useState, useEffect } from "react";
import { Cpu, RefreshCw, AlertTriangle, Lightbulb, Activity, Ban, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { UartConfig, PinConfig } from "@/hooks/useSerial";

// Definicja pinów dla ESP32-C3
const AVAILABLE_PINS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 21];
const RESERVED_USB_PINS = [20, 21];

interface PinsPageProps {
  uartConfigs: UartConfig[];
  pinConfigs: PinConfig[];
  onSend: (data: string) => Promise<void> | void;
}

const PinsPage = ({ uartConfigs, pinConfigs, onSend }: PinsPageProps) => {
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

  const getPinStatus = (pin: number) => {
    if (RESERVED_USB_PINS.includes(pin)) {
      return {
        locked: true,
        reason: "Reserved for USB/programming (GPIO 20/21)"
      };
    }

    // Sprawdź czy pin jest używany przez UART
    const uartUsage = uartConfigs.find(u => u.enabled && (u.rx === pin || u.tx === pin));
    if (uartUsage) {
      return {
        locked: true,
        reason: `Used by UART ${uartUsage.id} (${uartUsage.type})`
      };
    }
    return { locked: false, reason: "" };
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="text-primary" />
          <h2 className="text-lg font-semibold">Pin Configuration</h2>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(pendingChanges).length > 0 && (
            <Button size="sm" onClick={handleSaveAll}>
              <Save className="mr-2 h-4 w-4" />
              Save All ({Object.keys(pendingChanges).length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onSend("PIN_TABLE")}>
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
            <Card key={pin} className={`p-4 border ${status.locked ? 'bg-muted/50 border-muted' : hasChange ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
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
                    </SelectContent>
                  </Select>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PinsPage;
