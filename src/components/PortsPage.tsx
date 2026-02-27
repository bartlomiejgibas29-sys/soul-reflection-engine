import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

const PINS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 21];
const UART_OPTIONS = ["None", "UART(1)", "UART(2)", "UART(3)", "Light"];
const SPEC_OPTIONS = ["RX", "TX"];

interface PinConfig {
  uart: string;
  specification: string;
}

const defaultConfig = (): PinConfig => ({
  uart: "None",
  specification: "None",
});

const PortsPage = () => {
  const [configs, setConfigs] = useState<Record<number, PinConfig>>(
    () => Object.fromEntries(PINS.map((p) => [p, defaultConfig()]))
  );

  const update = (pin: number, key: keyof PinConfig, value: string) => {
    setConfigs((prev) => {
      const updated = { ...prev[pin], [key]: value };
      // Reset specification when UART changes
      if (key === "uart") {
        updated.specification = value.startsWith("UART") ? "RX" : "None";
      }
      return { ...prev, [pin]: updated };
    });
  };

  return (
    <div>
      <div className="bg-accent/30 border border-accent/50 rounded p-3 mb-4 text-sm text-muted-foreground">
        <p><strong>Note:</strong> not all combinations are valid. When the flight controller firmware detects this the serial port configuration will be reset.</p>
        <p><strong>Note:</strong> Do <span className="text-destructive font-bold">NOT</span> disable MSP on the first serial port unless you know what you are doing.</p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-semibold">Identifier</TableHead>
              <TableHead className="text-xs font-semibold">PINS</TableHead>
              <TableHead className="text-xs font-semibold">Specification</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PINS.map((pin) => {
              const cfg = configs[pin];
              const isUart = cfg.uart.startsWith("UART");
              return (
                <TableRow key={pin}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    PIN {pin}
                  </TableCell>
                  <TableCell>
                    <Select value={cfg.uart} onValueChange={(v) => update(pin, "uart", v)}>
                      <SelectTrigger className="h-8 text-xs w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UART_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {isUart ? (
                      <Select value={cfg.specification} onValueChange={(v) => update(pin, "specification", v)}>
                        <SelectTrigger className="h-8 text-xs w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SPEC_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PortsPage;
