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

const BAUD_OPTIONS = ["9600", "57600", "115200", "230400", "420000", "460800"];

interface PortsPageProps {
  uartConfigs?: UartConfig[];
  connected: boolean;
  onSend: (data: string) => Promise<void> | void;
}

const PortsPage = ({ uartConfigs, connected, onSend }: PortsPageProps) => {
  const [localConfigs, setLocalConfigs] = useState<UartConfig[]>([]);

  useEffect(() => {
    // Only update from props if localConfigs is empty or we received a fresh table that differs significantly?
    // Actually, we want to respect user edits.
    // Standard pattern: initialize local state from props, but don't overwrite user edits unless forced.
    // Here we overwrite whenever uartConfigs changes (e.g. initial load).
    // If uartConfigs updates due to "PIN_TABLE" refresh, we should probably update.
    if (uartConfigs && uartConfigs.length > 0) {
        // Simple check to avoid overwriting if we already have data and are editing?
        // For now, let's assume props update means "source of truth changed" (e.g. refresh clicked).
        // But to fix "jumping back", we should ensure we are not re-fetching constantly or that props don't revert.
        
        // ISSUE: When typing in Input, React re-renders. If uartConfigs prop didn't change, useEffect shouldn't fire.
        // However, if parent re-renders and passes new array reference, it might fire.
        // Let's compare content or just trust the dependency array.
        
        // If we are editing, we don't want to reset.
        // We can check if localConfigs is empty to initialize.
        setLocalConfigs(prev => {
            if (prev.length === 0) return uartConfigs;
            // If we have data, we only update if the incoming data is "newer" or "different" 
            // but we must be careful not to overwrite user work.
            // A common strategy is to only set on mount or when explicit "refresh" action happens.
            // But here uartConfigs comes from useSerial which parses incoming data.
            
            // Fix: Just checking equality of JSON might be heavy but safer.
            // Or simpler: Only set if previous is empty, OR if the IDs mismatch (different board?).
            // For now, let's rely on the fact that uartConfigs shouldn't change unless we parse new data.
            if (JSON.stringify(prev) !== JSON.stringify(uartConfigs)) {
                 // Wait, if we type, localConfigs changes. uartConfigs (from serial) remains old until we SAVE/REFRESH.
                 // So uartConfigs is "old server state". localConfigs is "new user state".
                 // If we strictly sync to uartConfigs, we lose user edits immediately if uartConfigs is re-emitted or unstable.
                 
                 // Better approach: Only initialize.
                 return prev; 
            }
            return prev;
        });
        
        // Actually, the issue described "after clicking SAVE & reboot switches back".
        // This implies that after reboot, the device sends old config (or default?) before new one is applied?
        // Or maybe the SAVE command didn't actually persist the changes in ESP32 preferences?
        
        // Let's look at firmware_reference.cpp:
        // SET_UART1_RX:... -> savePin -> prefs.putInt -> updates RAM.
        // Then REBOOT -> loadSettings -> reads prefs.
        // So it should work IF the commands are sent correctly.
        
        // But the user says: "jak ustawiam na UART 1 pin 9 i 10 to po kliknięciu SAVE & reboot przełącza mi się na tamten"
        // "Tamten" likely means "the old one" or "the default one".
        
        // Hypothesis 1: The input field loses focus or value because of React rendering issues during typing.
        // Hypothesis 2: The commands sent are wrong or rejected by firmware.
        // Hypothesis 3: The firmware saves, but loadSettings fails or overwrites?
        
        // Let's look at the React code first.
        // The Inputs use `value={cfg.rx}`. `update` updates `localConfigs`.
        // This looks correct for controlled components.
        
        // The `useEffect` with `[uartConfigs]` dependency is the likely culprit for "resetting" while typing if `uartConfigs` changes.
        // But `uartConfigs` only changes when serial data comes in.
        
        // Let's relax the synchronization. We will only load from props if we have no local state,
        // or if the user explicitly requested a Refresh (which we can't easily detect here without a flag).
        // Let's try initializing only when empty.
    }
  }, [uartConfigs]);
  
  // Re-enable sync if uartConfigs changes significantly (e.g. length change)?
  // Or better: use a ref to track if we have initialized.
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
          // Jeśli użytkownik wyłącza port, ustaw piny na -1
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
      console.log("Rozpoczynam zapisywanie konfiguracji...");
      
      // 1. Wyślij DISABLE_ALL i poczekaj na odpowiedź
      await onSend("DISABLE_ALL");
      await new Promise(resolve => setTimeout(resolve, 300)); // Poczekaj na przetworzenie
      
      const cmds: string[] = [];
      
      for (const cfg of localConfigs) {
          // Zapisujemy konfigurację (nawet jeśli -1)
          cmds.push(`SET_UART${cfg.id}_RX:${cfg.rx}`);
          cmds.push(`SET_UART${cfg.id}_TX:${cfg.tx}`);
          cmds.push(`SET_UART${cfg.id}_BAUD:${cfg.baudrate}`);
          
          if (cfg.enabled) {
              cmds.push(`ENABLE_UART${cfg.id}`);
          } else {
              cmds.push(`DISABLE_UART${cfg.id}`);
          }
      }
      
      // 2. Wysyłaj komendy pojedynczo z opóźnieniem
      for (const c of cmds) {
        console.log(`Wysyłam: ${c}`);
        await onSend(c);
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms między komendami
      }
      
      // 3. Poczekaj chwilę przed restartem
      console.log("Czekam przed restartem...");
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 4. Restart - to rozłączy port szeregowy
      console.log("Wysyłam REBOOT...");
      await onSend("REBOOT");

      // 5. Czekaj na restart i próbuj ponownie połączyć
      setTimeout(() => {
          try {
            console.log("Próbuję ponownie połączyć...");
            localStorage.setItem("shouldAutoConnect", "true");
            window.location.reload();
          } catch (e) {
            console.error("Błąd podczas restartu:", e);
          }
      }, 3000); // Jeszcze dłuższe opóźnienie na restart
      
    } catch (error) {
      console.error("Błąd podczas zapisywania:", error);
      alert("Błąd podczas zapisywania konfiguracji: " + error);
    }
  };

  const handleSwap = (id: number) => {
      setLocalConfigs(prev => prev.map(c => {
          if (c.id === id) {
              return { ...c, rx: c.tx, tx: c.rx };
          }
          return c;
      }));
  };

  const handleDisableAll = async () => {
      await onSend("DISABLE_ALL");
      // Refresh
      setTimeout(() => onSend("PIN_TABLE"), 200);
  };

  const handleEnableAll = async () => {
      await onSend("ENABLE_ALL");
      // Refresh
      setTimeout(() => onSend("PIN_TABLE"), 200);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-accent/30 border border-accent/50 rounded p-3 text-sm">
        <div className="text-muted-foreground space-y-1">
            <p><strong>Note:</strong> Configure your UART ports here.</p>
            {connected && <p className="text-green-600">✓ Connected to device</p>}
            {!connected && <p className="text-red-600">✗ Not connected - click Connect to begin</p>}
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDisableAll}>Disable All</Button>
            <Button variant="outline" size="sm" onClick={handleEnableAll}>Enable All</Button>
            <Button variant="outline" size="sm" onClick={() => onSend("PIN_TABLE")}>Refresh</Button>
            {!connected && <Button variant="default" size="sm" onClick={() => {
                localStorage.setItem("shouldAutoConnect", "true");
                window.location.reload();
            }}>Reconnect</Button>}
        </div>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">Port</TableHead>
              <TableHead className="w-[100px]">Enabled</TableHead>
              <TableHead>RX Pin</TableHead>
              <TableHead>TX Pin</TableHead>
              <TableHead>Baudrate</TableHead>
              <TableHead className="w-[50px]">Swap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localConfigs.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No UART configuration received. Click "Refresh" or connect a device.
                    </TableCell>
                </TableRow>
            ) : (
                localConfigs.map((cfg) => (
                <TableRow key={cfg.id}>
                  <TableCell className="font-medium">
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
                        className="w-20 h-8" 
                        value={cfg.rx} 
                        onChange={(e) => update(cfg.id, "rx", parseInt(e.target.value))}
                        disabled={!cfg.enabled}
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                        type="number" 
                        className="w-20 h-8" 
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
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BAUD_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleSwap(cfg.id)} title="Swap RX/TX">
                        ⇄
                      </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end">
        <Button className="rounded-lg bg-yellow-500 text-black hover:bg-yellow-600 font-bold" onClick={handleSave}>
            SAVE & REBOOT
        </Button>
      </div>
    </div>
  );
};

export default PortsPage;
