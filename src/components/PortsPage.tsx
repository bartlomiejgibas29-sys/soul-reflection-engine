import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

const PINS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 21];

const UART_OPTIONS = ["None", "UART(1)", "UART(2)", "UART(3)", "Light"];

const FUNCTION_OPTIONS = ["Disabled", "AUTO"];

interface PinConfig {
  uart: string;
  serialRx: boolean;
  telemetryFunc: string;
  telemetryMode: string;
  sensorFunc: string;
  sensorMode: string;
  peripheralFunc: string;
  peripheralMode: string;
}

const defaultConfig = (): PinConfig => ({
  uart: "None",
  serialRx: false,
  telemetryFunc: "Disabled",
  telemetryMode: "AUTO",
  sensorFunc: "Disabled",
  sensorMode: "AUTO",
  peripheralFunc: "Disabled",
  peripheralMode: "AUTO",
});

const PortsPage = () => {
  const [configs, setConfigs] = useState<Record<number, PinConfig>>(
    () => Object.fromEntries(PINS.map((p) => [p, defaultConfig()]))
  );

  const update = (pin: number, key: keyof PinConfig, value: string | boolean) => {
    setConfigs((prev) => ({
      ...prev,
      [pin]: { ...prev[pin], [key]: value },
    }));
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
              <TableHead className="text-xs font-semibold text-center">Serial Rx</TableHead>
              <TableHead className="text-xs font-semibold" colSpan={2}>Telemetry Output</TableHead>
              <TableHead className="text-xs font-semibold" colSpan={2}>Sensor Input</TableHead>
              <TableHead className="text-xs font-semibold" colSpan={2}>Peripherals</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PINS.map((pin) => {
              const cfg = configs[pin];
              return (
                <TableRow key={pin}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    PIN {pin}
                  </TableCell>

                  {/* PINS / UART selection */}
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

                  {/* Serial Rx */}
                  <TableCell className="text-center">
                    <Switch
                      checked={cfg.serialRx}
                      onCheckedChange={(v) => update(pin, "serialRx", v)}
                    />
                  </TableCell>

                  {/* Telemetry Output */}
                  <TableCell>
                    <Select value={cfg.telemetryFunc} onValueChange={(v) => update(pin, "telemetryFunc", v)}>
                      <SelectTrigger className="h-8 text-xs w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FUNCTION_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={cfg.telemetryMode} onValueChange={(v) => update(pin, "telemetryMode", v)}>
                      <SelectTrigger className="h-8 text-xs w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUTO" className="text-xs">AUTO</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Sensor Input */}
                  <TableCell>
                    <Select value={cfg.sensorFunc} onValueChange={(v) => update(pin, "sensorFunc", v)}>
                      <SelectTrigger className="h-8 text-xs w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FUNCTION_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={cfg.sensorMode} onValueChange={(v) => update(pin, "sensorMode", v)}>
                      <SelectTrigger className="h-8 text-xs w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUTO" className="text-xs">AUTO</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Peripherals */}
                  <TableCell>
                    <Select value={cfg.peripheralFunc} onValueChange={(v) => update(pin, "peripheralFunc", v)}>
                      <SelectTrigger className="h-8 text-xs w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FUNCTION_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={cfg.peripheralMode} onValueChange={(v) => update(pin, "peripheralMode", v)}>
                      <SelectTrigger className="h-8 text-xs w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUTO" className="text-xs">AUTO</SelectItem>
                      </SelectContent>
                    </Select>
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
