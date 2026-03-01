import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import type { UartConfig } from "@/hooks/useSerial";
import { Input } from "@/components/ui/input";
import { RefreshCw, Save, ArrowLeftRight } from "lucide-react";

const BAUD_OPTIONS = ["9600", "57600", "115200", "230400", "420000", "460800"];

interface PortsPageProps {
  uartConfigs?: UartConfig[];
  connected: boolean;
  onSend: (data: string) => Promise<void> | void;
}

const PortsPage = ({ uartConfigs, connected, onSend }: PortsPageProps) => {
  const [localConfigs, setLocalConfigs] = useState<UartConfig[]>([]);

  useEffect(() => {
    if (uartConfigs && uartConfigs.length > 0) {
      setLocalConfigs(prev => {
        if (prev.length === 0) return uartConfigs;
        return prev;
      });
    }
  }, [uartConfigs]);

  useEffect(() => {
    if (uartConfigs && uartConfigs.length > 0 && localConfigs.length === 0) {
      setLocalConfigs(uartConfigs);
    }
  }, [uartConfigs, localConfigs.length]);

  const update = (id: number, key: keyof UartConfig, value: any) => {
    setLocalConfigs((prev) =>
      prev.map(c => {
        if (c.id === id) {
          const updated = { ...c, [key]: value };
          if (key === "enabled" && value === false) {
            updated.rx = -1;
            updated.tx = -1;
          }
          return updated;
        }
        return c;
      })
    );
  };

  const handleSave = async () => {
    try {
      await onSend("DISABLE_ALL");
      await new Promise(resolve => setTimeout(resolve, 300));

      const cmds: string[] = [];
      for (const cfg of localConfigs) {
        cmds.push(`SET_UART${cfg.id}_RX:${cfg.rx}`);
        cmds.push(`SET_UART${cfg.id}_TX:${cfg.tx}`);
        cmds.push(`SET_UART${cfg.id}_BAUD:${cfg.baudrate}`);
        if (cfg.enabled) {
          cmds.push(`ENABLE_UART${cfg.id}`);
        } else {
          cmds.push(`DISABLE_UART${cfg.id}`);
        }
      }

      for (const c of cmds) {
        await onSend(c);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      await new Promise(resolve => setTimeout(resolve, 800));
      await onSend("REBOOT");

      setTimeout(() => {
        localStorage.setItem("shouldAutoConnect", "true");
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error("Save error:", error);
      alert("Error saving configuration: " + error);
    }
  };

  const handleSwap = (id: number) => {
    setLocalConfigs(prev => prev.map(c => {
      if (c.id === id) return { ...c, rx: c.tx, tx: c.rx };
      return c;
    }));
  };

  const handleDisableAll = async () => {
    await onSend("DISABLE_ALL");
    setTimeout(() => onSend("PIN_TABLE"), 200);
  };

  const handleEnableAll = async () => {
    await onSend("ENABLE_ALL");
    setTimeout(() => onSend("PIN_TABLE"), 200);
  };

  return (
    <div className="space-y-4">
      {/* Status & actions bar */}
      <div className="flex flex-wrap justify-between items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
        <div className="flex items-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[hsl(var(--sensor-ok))]' : 'bg-destructive'}`} />
          <span className="text-muted-foreground">
            {connected ? "Connected — configure UART ports below" : "Not connected — click Connect to begin"}
          </span>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleDisableAll}>Disable All</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleEnableAll}>Enable All</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onSend("PIN_TABLE")}>
            <RefreshCw size={12} /> Refresh
          </Button>
        </div>
      </div>

      {/* Warnings */}
      <div className="space-y-2 text-xs">
        <div className="bg-primary/8 border border-primary/20 rounded-lg px-4 py-2 text-primary/80">
          ⚠ Setting UART to pins <strong>0</strong> and <strong>1</strong> is not recommended — they are used for USB communication.
        </div>
        <div className="bg-primary/8 border border-primary/20 rounded-lg px-4 py-2 text-primary/80">
          💡 Pins <strong>20</strong> and <strong>21</strong> should be used as UART1.
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-card hover:bg-card">
              <TableHead className="w-[90px] text-xs font-semibold text-muted-foreground">Port</TableHead>
              <TableHead className="w-[80px] text-xs font-semibold text-muted-foreground">Enabled</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">RX Pin</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">TX Pin</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Baudrate</TableHead>
              <TableHead className="w-[50px] text-xs font-semibold text-muted-foreground text-center">Swap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localConfigs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                  No UART configuration received. Click <strong>Refresh</strong> or connect a device.
                </TableCell>
              </TableRow>
            ) : (
              localConfigs.map((cfg) => (
                <TableRow key={cfg.id} className={`transition-colors ${cfg.enabled ? '' : 'opacity-50'}`}>
                  <TableCell className="font-semibold text-sm text-foreground">
                    UART {cfg.id}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={cfg.enabled}
                      onCheckedChange={(checked) => update(cfg.id, "enabled", checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-20 h-7 text-xs font-mono bg-secondary/50 border-border"
                      value={cfg.rx}
                      onChange={(e) => update(cfg.id, "rx", parseInt(e.target.value))}
                      disabled={!cfg.enabled}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-20 h-7 text-xs font-mono bg-secondary/50 border-border"
                      value={cfg.tx}
                      onChange={(e) => update(cfg.id, "tx", parseInt(e.target.value))}
                      disabled={!cfg.enabled}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={cfg.baudrate.toString()}
                      onValueChange={(v) => update(cfg.id, "baudrate", parseInt(v))}
                      disabled={!cfg.enabled}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs font-mono bg-secondary/50 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BAUD_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={() => handleSwap(cfg.id)}
                      title="Swap RX/TX"
                      disabled={!cfg.enabled}
                    >
                      <ArrowLeftRight size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-1">
        <Button
          className="h-9 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm gap-2"
          onClick={handleSave}
        >
          <Save size={14} />
          SAVE & REBOOT
        </Button>
      </div>
    </div>
  );
};

export default PortsPage;
