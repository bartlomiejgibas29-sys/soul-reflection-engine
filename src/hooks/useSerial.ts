import { useState, useCallback, useRef } from "react";

interface DeviceInfo {
  configurator?: string;
  firmware?: string;
  target?: string;
}

export function useSerial() {
  const [connected, setConnected] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const portRef = useRef<any>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const connect = useCallback(async () => {
    try {
      if (!("serial" in navigator)) {
        alert("Twoja przeglądarka nie obsługuje Web Serial API. Użyj Chrome lub Edge.");
        return;
      }

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      setConnected(true);

      // Placeholder device info - will be read from device in future
      setDeviceInfo({
        configurator: "1.0.0",
        firmware: "ESP32-C3",
        target: "ESP32-C3",
      });

      // Start reading (background)
      const reader = port.readable?.getReader();
      if (reader) {
        readerRef.current = reader;
        readLoop(reader);
      }
    } catch (err: any) {
      if (err.name !== "NotFoundError") {
        console.error("Serial connection error:", err);
      }
    }
  }, []);

  const readLoop = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        // TODO: parse incoming data from ESP32-C3
        const text = new TextDecoder().decode(value);
        console.log("[Serial RX]:", text);
      }
    } catch (err) {
      console.log("Serial read ended:", err);
    }
  };

  const disconnect = useCallback(async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
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
  }, []);

  return { connected, deviceInfo, connect, disconnect };
}
