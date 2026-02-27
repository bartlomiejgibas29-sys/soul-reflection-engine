import { useState, useCallback, useRef } from "react";

interface DeviceInfo {
  configurator?: string;
  firmware?: string;
  target?: string;
}

export interface PinConfig {
  uart: string;
  specification: string;
}

export function useSerial() {
  const [connected, setConnected] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [lastSent, setLastSent] = useState<string>("");
  const [pinConfigs, setPinConfigs] = useState<Record<number, PinConfig> | null>(null);
  const portRef = useRef<any>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const bufferRef = useRef<string>("");

  const parseBoardResponse = useCallback((data: string) => {
    const lines = data.split("\n").map(l => l.trim()).filter(Boolean);
    let board = "";
    const configs: Record<number, PinConfig> = {};

    for (const line of lines) {
      // First line or line matching board name
      if (/^esp32/i.test(line)) {
        board = line.toLowerCase();
        continue;
      }
      // Format: PIN0:UART1:RX or PIN20:None:None
      const match = line.match(/^PIN(\d+):([^:]+):([^:]+)$/i);
      if (match) {
        const pin = parseInt(match[1]);
        const uart = match[2].trim();
        const spec = match[3].trim();
        configs[pin] = {
          uart: uart === "None" ? "None" : uart.replace("UART", "UART(") + ")",
          specification: spec,
        };
      }
    }

    if (board) {
      setDeviceInfo({
        configurator: "1.0.0",
        firmware: board,
        target: board,
      });
    }

    if (Object.keys(configs).length > 0) {
      setPinConfigs(configs);
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      if (!("serial" in navigator)) {
        alert("Web Serial API niedostępne. Otwórz stronę bezpośrednio w Chrome/Edge (nie w iframe).");
        return;
      }

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      setConnected(true);
      setLastSent("Połączono z portem szeregowym");
      bufferRef.current = "";

      port.addEventListener("disconnect", () => {
        setConnected(false);
        setDeviceInfo(null);
        setPinConfigs(null);
        setLastSent("Urządzenie odłączone");
        portRef.current = null;
        readerRef.current = null;
        writerRef.current = null;
      });

      // Writer
      const writer = port.writable?.getWriter();
      if (writer) writerRef.current = writer;

      // Reader
      const reader = port.readable?.getReader();
      if (reader) {
        readerRef.current = reader;
        readLoop(reader);
      }

      // Send REBOOT to identify the board
      if (writer) {
        const encoded = new TextEncoder().encode("REBOOT\n");
        await writer.write(encoded);
        setLastSent("TX: REBOOT");
      }
    } catch (err: any) {
      if (err.name === "SecurityError") {
        alert("Web Serial jest zablokowane w iframe. Otwórz stronę w nowej karcie.");
      } else if (err.name !== "NotFoundError") {
        console.error("Serial connection error:", err);
      }
    }
  }, []);

  const readLoop = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        console.log("[Serial RX]:", text);
        
        // Buffer incoming data and parse when we get END marker or enough data
        bufferRef.current += text;
        if (bufferRef.current.includes("END")) {
          const fullResponse = bufferRef.current.split("END")[0];
          parseBoardResponse(fullResponse);
          bufferRef.current = "";
        }
      }
    } catch (err) {
      console.log("Serial read ended:", err);
    }
  };

  const send = useCallback(async (data: string) => {
    if (writerRef.current) {
      const encoded = new TextEncoder().encode(data + "\n");
      await writerRef.current.write(encoded);
      setLastSent(`TX: ${data}`);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      if (writerRef.current) {
        writerRef.current.releaseLock();
        writerRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
    } catch (err) {
      console.error("Disconnect error:", err);
    }
    setConnected(false);
    setDeviceInfo(null);
    setPinConfigs(null);
    setLastSent("Rozłączono");
  }, []);

  return { connected, deviceInfo, lastSent, pinConfigs, connect, disconnect, send };
}
