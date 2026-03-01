import { useState, useCallback, useRef, useEffect } from "react";

interface DeviceInfo {
  configurator?: string;
  firmware?: string;
  target?: string;
}

export interface UartConfig {
  id: number;
  enabled: boolean;
  rx: number;
  tx: number;
  baudrate: number;
  type: "GENERIC" | "RECEIVER" | "GPS";
}

export interface ReceiverData {
  channels: number[]; // 1-16
  uplinkRSS1: number;
  uplinkRSS2: number;
  uplinkLQ: number;
  uplinkSNR: number;
  activeAntenna: number;
  rfMode: number;
  uplinkTXPower: number;
  downlinkRSSI: number;
  downlinkLQ: number;
  downlinkSNR: number;
}

export interface GpsData {
  fix: boolean;
  numSatellites: number;
  altitude: number; // meters
  speed: number; // cm/s
  headingImu: number;
  headingGps: number;
  latitude: number;
  longitude: number;
  distToHome: number;
  dop: number;
  satellites: GpsSatellite[];
}

export interface GpsSatellite {
  gnssId: string;
  satId: number;
  signalStrength: number; // 0-100? or dB
  status: "used" | "unused";
  quality: "fully locked" | "searching" | "unusable" | "code locked";
}

export interface ReceiverSettings {
  telemetry: boolean;
  rssiAdc: boolean;
  rssiChannel: number;
  channelMap: string;
  rcMin: number;
  rcMid: number;
  rcMax: number;
  deadbandRc: number;
  deadbandYaw: number;
  deadbandThr3d: number;
  rcSmoothing: boolean;
  rcSmoothingCoeff: number;
}

export function useSerial() {
  const [connected, setConnected] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [lastSent, setLastSent] = useState<string>("");
  const [uartConfigs, setUartConfigs] = useState<UartConfig[]>([]);
  const [receiverData, setReceiverData] = useState<ReceiverData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [gpsData, setGpsData] = useState<GpsData | null>(null);
  const [receiverSettings, setReceiverSettings] = useState<ReceiverSettings | null>(null);
  
  const portRef = useRef<any>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const bufferRef = useRef<string>("");

  const parseBoardResponse = useCallback((data: string) => {
    const lines = data.split("\n").map(l => l.trim()).filter(Boolean);
    let board = "";
    
    // We will collect UART configs here
    // But since data comes in chunks, we might receive partial CSV or updates
    // For simplicity, we parse line by line and update state if it matches CSV format
    
    for (const line of lines) {
      // Check for board info
      if (/^ESP-ROM:/i.test(line)) {
        board = line.replace(/^ESP-ROM:/i, "").trim();
      } else if (/^=== SYSTEM START ===/i.test(line) || /^=== SYSTEM UART MULTIPLEXER ===/i.test(line)) {
        board = "esp32c3";
      }

      // Parse CSV line: U<id>,<ENABLED|DISABLED>,<RX>,<TX>,<BAUD>,<TYPE>
      // Example: U1,ENABLED,4,5,115200,RECEIVER
      const csvMatch = line.match(/^U(\d+),(ENABLED|DISABLED),(-?\d+),(-?\d+),(\d+)(?:,([A-Z]+))?$/i);
      if (csvMatch) {
        const [, idStr, statusStr, rxStr, txStr, baudStr, typeStr] = csvMatch;
        const newConfig: UartConfig = {
          id: parseInt(idStr),
          enabled: statusStr.toUpperCase() === "ENABLED",
          rx: parseInt(rxStr),
          tx: parseInt(txStr),
          baudrate: parseInt(baudStr),
          type: (typeStr || "GENERIC").toUpperCase() as any
        };
        
        setUartConfigs(prev => {
          const exists = prev.find(c => c.id === newConfig.id);
          if (exists) {
            return prev.map(c => c.id === newConfig.id ? newConfig : c);
          }
          return [...prev, newConfig].sort((a, b) => a.id - b.id);
        });
        continue;
      }

      // Parse GPS Data: GPS_FULL,fix,sats,lat,lon,alt,speed,course,hdop
      if (line.startsWith("GPS_FULL,")) {
        const parts = line.split(",");
        if (parts.length >= 9) {
          const fix = parts[1] === "1";
          const numSat = parseInt(parts[2]) || 0;
          const lat = parseFloat(parts[3]) || 0;
          const lon = parseFloat(parts[4]) || 0;
          const alt = parseFloat(parts[5]) || 0;
          const spd = parseFloat(parts[6]) || 0;
          const hdg = parseFloat(parts[7]) || 0;
          const dop = parseFloat(parts[8]) || 0;
          const base = Math.max(0, Math.min(100, Math.round(100 / Math.max(1, dop))));
          const sats =
            numSat > 0
              ? Array.from({ length: numSat }).map((_, i) => ({
                  gnssId: "GPS",
                  satId: i + 1,
                  signalStrength: Math.max(10, Math.min(100, base - i * 3)),
                  status: fix ? "used" : "unused",
                  quality: fix ? "fully locked" : "searching",
                }))
              : [];
          setGpsData({
            fix,
            numSatellites: numSat,
            latitude: lat,
            longitude: lon,
            altitude: alt,
            speed: spd,
            headingGps: hdg,
            dop,
            headingImu: 0,
            distToHome: 0,
            satellites: sats,
          });
        }
        continue;
      }

      // Parse RX settings: RX_SETTINGS,telemetry,rssi_adc,rssi_ch,map,rcmin,rcmid,rcmax,db_rc,db_yaw,db_thr3d,rc_smooth,rc_coeff
      if (line.startsWith("RX_SETTINGS,")) {
        const parts = line.split(",");
        if (parts.length >= 14) {
          setReceiverSettings({
            telemetry: parts[1] === "1",
            rssiAdc: parts[2] === "1",
            rssiChannel: parseInt(parts[3]) || -1,
            channelMap: parts[4],
            rcMin: parseInt(parts[5]) || 1000,
            rcMid: parseInt(parts[6]) || 1500,
            rcMax: parseInt(parts[7]) || 2000,
            deadbandRc: parseInt(parts[8]) || 0,
            deadbandYaw: parseInt(parts[9]) || 0,
            deadbandThr3d: parseInt(parts[10]) || 0,
            rcSmoothing: parts[11] === "1",
            rcSmoothingCoeff: parseInt(parts[12]) || 30,
          });
        }
        continue;
      }

      // Parse ELRS Data: ELRS_FULL,ch1...ch16,stats...
      if (line.startsWith("ELRS_FULL,")) {
          const parts = line.split(",");
          // ELRS_FULL is index 0. channels 1-16 are indices 1-16. stats are 17-26
          if (parts.length >= 27) {
              const channels = parts.slice(1, 17).map(Number);
              const stats = parts.slice(17).map(Number);
              
              setReceiverData({
                  channels,
                  uplinkRSS1: stats[0],
                  uplinkRSS2: stats[1],
                  uplinkLQ: stats[2],
                  uplinkSNR: stats[3],
                  activeAntenna: stats[4],
                  rfMode: stats[5],
                  uplinkTXPower: stats[6],
                  downlinkRSSI: stats[7],
                  downlinkLQ: stats[8],
                  downlinkSNR: stats[9]
              });
          }
          continue;
      }
    }

    if (board) {
      setDeviceInfo({
        configurator: "1.0.0",
        firmware: board,
        target: board,
      });
    }
  }, []);

  const send = useCallback(async (data: string) => {
    if (!portRef.current || !portRef.current.writable) return;
    
    try {
        const writer = portRef.current.writable.getWriter();
        const encoded = new TextEncoder().encode(data + "\n");
        await writer.write(encoded);
        writer.releaseLock();
        
        setLastSent(`TX: ${data}`);
        setLogs(prev => [...prev, `> ${data}\n`]);
    } catch (err) {
        console.error("Send error:", err);
        setLogs(prev => [...prev, `Error sending: ${err}\n`]);
    }
  }, []);

  const readLoop = useCallback(async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.log("Serial read completed normally");
          break;
        }
        
        if (!value || value.length === 0) {
          continue; // Pusta ramka, kontynuuj
        }
        
        const text = new TextDecoder().decode(value);
        
        setLogs(prev => {
            const newLogs = [...prev, text];
            return newLogs.slice(-2000); 
        });
        
        bufferRef.current += text;
        let idx = bufferRef.current.indexOf("\n");
        while (idx !== -1) {
          const line = bufferRef.current.slice(0, idx + 1);
          parseBoardResponse(line);
          bufferRef.current = bufferRef.current.slice(idx + 1);
          idx = bufferRef.current.indexOf("\n");
        }
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('cancel')) {
        console.log("Serial read cancelled by user");
      } else if (err.name === 'NetworkError' || err.message?.includes('break')) {
        console.log("Serial connection broken - device may have reset");
        setLogs(prev => [...prev, `[System] Connection lost - device may have reset\n`]);
      } else {
        console.error("Serial read error:", err);
        setLogs(prev => [...prev, `Serial read error: ${err.message}\n`]);
      }
    } finally {
      try {
        reader.releaseLock();
      } catch (e) {
        console.log("Reader already released");
      }
    }
  }, [parseBoardResponse]);

  const disconnect = useCallback(async () => {
    try {
      console.log("Rozłączanie...");
      
      if (readerRef.current) {
        try {
          await readerRef.current.cancel();
        } catch (e) {
          console.log("Reader cancel error (już zamknięty?)");
        }
        readerRef.current = null;
      }
      
      if (portRef.current) {
        try {
          if (portRef.current.readable || portRef.current.writable) {
            await portRef.current.close();
          }
        } catch (e) {
          console.log("Port close error:", e);
        }
        portRef.current = null;
      }
    } catch (err) {
      console.error("Błąd podczas rozłączania:", err);
    }
    
    setConnected(false);
    setDeviceInfo(null);
    setUartConfigs([]);
    setReceiverData(null);
    setLastSent("Disconnected");
    setLogs(prev => [...prev, `[System] Disconnected\n`]);
    bufferRef.current = "";
  }, []);

  const connect = useCallback(async (baudRate: number = 115200) => {
    let openTimeout: any = null;
    try {
      if (!("serial" in navigator)) {
        alert("Web Serial API is unavailable. Open this page directly in Chrome/Edge (not in an iframe).");
        return;
      }

      if (connected) {
        await disconnect();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const port = await (navigator as any).serial.requestPort();
      
      openTimeout = setTimeout(() => {
        throw new Error("Timeout podczas otwierania portu szeregowego");
      }, 5000);
      
      await port.open({ baudRate });
      if (openTimeout) {
        clearTimeout(openTimeout);
        openTimeout = null;
      }
      
      portRef.current = port;
      setConnected(true);
      setLastSent("Connected to serial port");
      setLogs(prev => [...prev, `[System] Connected at ${baudRate} baud\n`]);
      localStorage.setItem("lastBaudRate", baudRate.toString());
      bufferRef.current = "";

      if (port.readable) {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        readLoop(reader);
      }

      setTimeout(() => {
        send("PIN_TABLE");
      }, 1000);

    } catch (err: any) {
      if (openTimeout) {
        clearTimeout(openTimeout);
        openTimeout = null;
      }
      
      if (err.name === "SecurityError") {
        alert("Web Serial is blocked in an iframe. Open the page in a new tab.");
      } else if (err.name === "NotFoundError") {
        console.log("User cancelled port selection");
      } else if (err.name === "NetworkError") {
        alert("Port szeregowy jest już używany przez inną aplikację lub nie jest dostępny.");
        setLogs(prev => [...prev, `[Error] Port unavailable - may be in use by another application\n`]);
      } else {
        console.error("Serial connection error:", err);
        setLogs(prev => [...prev, `Connection error: ${err.message}\n`]);
        alert("Błąd połączenia: " + err.message);
      }
      
      setConnected(false);
      portRef.current = null;
    }
  }, [readLoop, send, connected, disconnect]);

  useEffect(() => {
    const shouldConnect = localStorage.getItem("shouldAutoConnect");
    if (shouldConnect === "true") {
      localStorage.removeItem("shouldAutoConnect");
      const lastBaud = parseInt(localStorage.getItem("lastBaudRate") || "115200");
      
      (async () => {
        if (!("serial" in navigator)) return;
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const ports = await (navigator as any).serial.getPorts();
          if (ports.length > 0) {
            const port = ports[0];
            await port.open({ baudRate: lastBaud });
            portRef.current = port;
            setConnected(true);
            setLastSent("Auto-connected after restart");
            setLogs(prev => [...prev, `[System] Auto-connected at ${lastBaud} baud after restart\n`]);
            bufferRef.current = "";
            
            if (port.readable) {
              const reader = port.readable.getReader();
              readerRef.current = reader;
              readLoop(reader);
            }
            
            setTimeout(() => {
              send("PIN_TABLE");
            }, 500);
          } else {
            console.log("No serial ports available for auto-connect");
            setLogs(prev => [...prev, `[System] No serial ports available for auto-connect\n`]);
          }
        } catch (err) {
          console.error("Auto-connect error:", err);
          setLogs(prev => [...prev, `Auto-connect error: ${err}\n`]);
          localStorage.removeItem("shouldAutoConnect");
        }
      })();
    }
  }, [readLoop, send]);

  useEffect(() => {
    // Mock GPS data disabled, real parsing implemented
    // if (connected) { ... }
  }, [connected]);

  return { connected, deviceInfo, lastSent, uartConfigs, receiverData, gpsData, receiverSettings, logs, connect, disconnect, send };
}
