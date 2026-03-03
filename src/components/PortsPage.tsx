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
import { RefreshCw, Save, ArrowLeftRight, Cable, AlertTriangle, Lightbulb } from "lucide-react";

const BAUD_OPTIONS = ["9600", "57600", "115200", "230400", "420000", "460800"];
const LOW_BAUD_OPTIONS = ["9600", "57600", "115200"];

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
        cmds.push(`SET_UART${cfg.id}_TYPE:${cfg.type || "GENERIC"}`);
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
      {/* Header bar */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex flex-wrap justify-between items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Cable size={14} className="text-primary" />
            <span className="text-xs font-semibold text-foreground">UART Configuration</span>
            <div className="flex items-center gap-1.5 ml-2">
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[hsl(var(--sensor-ok))]' : 'bg-destructive'}`} />
              <span className="text-[10px] text-muted-foreground">
                {connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleDisableAll}>Disable All</Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleEnableAll}>Enable All</Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => onSend("PIN_TABLE")}>
              <RefreshCw size={11} /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Warnings */}
      <div className="space-y-1.5">
        <div className="flex items-start gap-2 bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="text-destructive mt-0.5 shrink-0" />
          <p className="text-[11px] text-destructive leading-relaxed">
            <strong>UART 2 & 3</strong> are emulated (SoftwareSerial). Max baudrate: <strong>115200</strong>. Do not use for ELRS receivers.
          </p>
        </div>
        <div className="flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
          <Lightbulb size={13} className="text-primary mt-0.5 shrink-0" />
          <p className="text-[11px] text-primary/80 leading-relaxed">
            Pins <strong>20</strong> and <strong>21</strong> are recommended for UART1. Avoid pins <strong>0/1</strong> (USB).
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30 hover:bg-secondary/30">
              <TableHead className="w-[90px] text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Port</TableHead>
              <TableHead className="w-[70px] text-[10px] font-bold text-muted-foreground uppercase tracking-wider">On</TableHead>
              <TableHead className="w-[120px] text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Function</TableHead>
              <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">RX</TableHead>
              <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">TX</TableHead>
              <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Baud</TableHead>
              <TableHead className="w-[44px] text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">⇄</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localConfigs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                  No UART data received. Click <strong className="text-foreground">Refresh</strong> or reconnect.
                </TableCell>
              </TableRow>
            ) : (
              localConfigs.map((cfg) => (
                <TableRow key={cfg.id} className={`transition-colors ${cfg.enabled ? '' : 'opacity-40'}`}>
                  <TableCell className="font-bold text-xs text-foreground">
                    UART {cfg.id}
                    {cfg.id === 1 && <span className="text-[9px] text-primary ml-1">HW</span>}
                    {cfg.id > 1 && <span className="text-[9px] text-muted-foreground ml-1">SW</span>}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={cfg.enabled}
                      onCheckedChange={(checked) => update(cfg.id, "enabled", checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={cfg.type || "GENERIC"}
                      onValueChange={(v) => update(cfg.id, "type", v)}
                      disabled={!cfg.enabled}
                    >
                      <SelectTrigger className="h-7 w-[100px] text-[11px] font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENERIC">GENERIC</SelectItem>
                        <SelectItem value="RECEIVER">RECEIVER</SelectItem>
                        <SelectItem value="GPS">GPS</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-16 h-7 text-[11px] font-mono bg-secondary/30"
                      value={cfg.rx}
                      onChange={(e) => update(cfg.id, "rx", parseInt(e.target.value))}
                      disabled={!cfg.enabled}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-16 h-7 text-[11px] font-mono bg-secondary/30"
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
                      <SelectTrigger className="h-7 w-24 text-[11px] font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(cfg.id === 1 ? BAUD_OPTIONS : LOW_BAUD_OPTIONS).map((opt) => (
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
                      disabled={!cfg.enabled}
                    >
                      <ArrowLeftRight size={13} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          className="h-9 px-8 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs gap-2 shadow-lg shadow-primary/20"
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
