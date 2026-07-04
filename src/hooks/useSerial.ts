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
  speed: number; // km/h (from firmware GPS_FULL)
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
  quality: "fully_locked" | "searching" | "unusable" | "code_locked" | "no_signal" | "acquired" | "fully locked";
}

export interface ReceiverSettings {
  controlMode: "PROPORTIONAL" | "DIRECTION_SELECTED";
  directionChannel: number;
  speedChannel: number;
  directionPressedIsReverse?: boolean;
  channelMap: string;
  rcMin: number;
  rcMid: number;
  rcMax: number;
  deadbandRc: number;
  deadbandYaw: number;
  deadbandThr3d: number;
  rcSmoothing: boolean;
  rcSmoothingCoeff: number;
  steeringChannel: number;
  throttleChannel: number;
  steeringRev: boolean;
  throttleRev: boolean;
}

export interface GpsSettings {
  protocol: string;
  autoConfig: boolean;
  useGalileo: boolean;
  setHomeOnce: boolean;
  groundAssistance: string;
  declination: number;
}

export interface PinConfig {
  pin: number;
  mode: "DISABLED" | "LIGHT" | "SERVO" | "STEERING" | "BATTERY" | "MOTOR";
  value?: number; // PWM value or state
}

export interface BatteryConfig {
  cells: number;
  r1: number;
  r2: number;
  calibration: number;
  pin: number;
  voltage: number;
}

export interface ServoRange {
  minIn: number;
  maxIn: number;
  targetUs: number;
}

export interface ServoConfig {
  pin: number;
  frequency: number;
  minUs: number;
  midUs: number;
  maxUs: number;
  sourceChannel: number; // 0 = none, 1-16 = RC Channel
  reverse: boolean;
  rate: number;          // deflection multiplier (1.0 = 100%)
  speed: number;         // us/sec, 0 = instant
  mode: number;          // 0=PROPORTIONAL, 1=RANGES
  minAngle: number;
  maxAngle: number;
  ranges: ServoRange[];
}

export interface ModuleStates {
  gps: boolean;
  receiver: boolean;
}

export interface MotorConfig {
  rpwmPin: number;
  lpwmPin: number;
  enPin: number;
  frequency: number;
  maxPwm: number;
  startupPwm: number;
  rampUpMs: number;
  rampDownMs: number;
  directionChangeMs: number;
  directionSmoothing: number;
  configured: boolean;
}

export interface MotorState {
  liveMode: boolean;
  targetValue: number;
  outputValue: number;
  failsafe: boolean;
}

export function useSerial() {
  const [connected, setConnected] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [lastSent, setLastSent] = useState<string>("");
  const [uartConfigs, setUartConfigs] = useState<UartConfig[]>([]);
  const [pinConfigs, setPinConfigs] = useState<PinConfig[]>([]);
  const [servoConfigs, setServoConfigs] = useState<ServoConfig[]>([]);
  const [receiverData, setReceiverData] = useState<ReceiverData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [gpsData, setGpsData] = useState<GpsData | null>(null);
  const [receiverSettings, setReceiverSettings] = useState<ReceiverSettings | null>(null);
  const [gpsSettings, setGpsSettings] = useState<GpsSettings | null>(null);
  const [batteryConfig, setBatteryConfig] = useState<BatteryConfig | null>(null);
  const [motorConfig, setMotorConfig] = useState<MotorConfig | null>(null);
  const [motorState, setMotorState] = useState<MotorState | null>(null);
  const [moduleStates, setModuleStates] = useState<ModuleStates>({ gps: true, receiver: true });
  const [pendingSatCount, setPendingSatCount] = useState<number>(0);
  const pendingSatsRef = useRef<GpsSatellite[]>([]);
  const pendingLogsRef = useRef<string[]>([]);
  
  const portRef = useRef<any>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const bufferRef = useRef<string>("");
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  // Flush logs periodically to avoid excessive re-renders
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingLogsRef.current.length > 0) {
        setLogs(prev => {
          const newLogs = [...prev, ...pendingLogsRef.current];
          pendingLogsRef.current = [];
          return newLogs.slice(-2000);
        });
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const parseBoardResponse = useCallback((line: string) => {
    line = line.trim();
    if (!line) return;
    
    let board = "";
    
    // Check for board info
    if (/^ESP-ROM:/i.test(line)) {
      board = line.replace(/^ESP-ROM:/i, "").trim();
    } else if (/^=== SYSTEM START ===/i.test(line) || /^=== SYSTEM UART MULTIPLEXER ===/i.test(line)) {
      board = "esp32c3";
    }

    const parseUartConfigLine = (parts: string[]) => {
      const id = parseInt(parts[1]);
      if (id < 1 || id > 3 || parts.length < 7) return;
      setUartConfigs(prev => {
        const next = [...prev];
        while (next.length < id) {
          next.push({ id: next.length + 1, enabled: false, rx: -1, tx: -1, baudrate: 9600, type: "GENERIC" });
        }
        const type = ["GENERIC", "RECEIVER", "GPS"].includes(parts[6]) ? parts[6] : "GENERIC";
        next[id - 1] = {
          id,
          enabled: parts[2] === "ENABLED",
          rx: parseInt(parts[3]),
          tx: parseInt(parts[4]),
          baudrate: parseInt(parts[5]),
          type: type as UartConfig["type"],
        };
        return next;
      });
    };

    // Parse UART config: UART_CONF,id,enabled,rx,tx,baud,type
    if (line.startsWith("UART_CONF,")) {
      parseUartConfigLine(line.split(","));
      return;
    }

    // Legacy boot format: U1,enabled,rx,tx,baud,type
    if (/^U[1-3],/.test(line)) {
      const parts = line.split(",");
      const legacyId = parseInt(parts[0].slice(1), 10);
      if (legacyId >= 1 && legacyId <= 3) {
        parseUartConfigLine([
          "UART_CONF",
          String(legacyId),
          parts[1],
          parts[2],
          parts[3],
          parts[4],
          parts[5] ?? "GENERIC",
        ]);
      }
      return;
    }

    // Parse BATTERY_CFG,cells,r1,r2,cal,pin,voltage
    if (line.startsWith("BATTERY_CFG,")) {
      const parts = line.split(",");
      if (parts.length >= 7) {
        setBatteryConfig({
          cells: parseInt(parts[1]),
          r1: parseFloat(parts[2]),
          r2: parseFloat(parts[3]),
          calibration: parseFloat(parts[4]),
          pin: parseInt(parts[5]),
          voltage: parseFloat(parts[6]),
        });
      }
      return;
    }

    if (line.startsWith("MOTOR_CFG,")) {
      const parts = line.split(",");
      if (parts.length >= 12) {
        setMotorConfig({
          rpwmPin: parseInt(parts[1]) || -1,
          lpwmPin: parseInt(parts[2]) || -1,
          enPin: parseInt(parts[3]) || -1,
          frequency: parseInt(parts[4]) || 20000,
          maxPwm: parseInt(parts[5]) || 100,
          startupPwm: parseInt(parts[6]) || 0,
          rampUpMs: parseInt(parts[7]) || 0,
          rampDownMs: parseInt(parts[8]) || 0,
          directionChangeMs: parseInt(parts[9]) || 0,
          directionSmoothing: parseInt(parts[10]) || 0,
          configured: parts[11] === "1",
        });
      }
      return;
    }

    if (line.startsWith("MOTOR_PINS,")) {
      const parts = line.split(",");
      if (parts.length >= 4) {
        setMotorConfig(prev => prev ? {
          ...prev,
          rpwmPin: parseInt(parts[1]) || -1,
          lpwmPin: parseInt(parts[2]) || -1,
          enPin: parseInt(parts[3]) || -1,
        } : {
          rpwmPin: parseInt(parts[1]) || -1,
          lpwmPin: parseInt(parts[2]) || -1,
          enPin: parseInt(parts[3]) || -1,
          frequency: 20000,
          maxPwm: 100,
          startupPwm: 0,
          rampUpMs: 0,
          rampDownMs: 0,
          directionChangeMs: 0,
          directionSmoothing: 0,
          configured: false,
        });
      }
      return;
    }

    if (line.startsWith("MOTOR_STATE,")) {
      const parts = line.split(",");
      if (parts.length >= 5) {
        setMotorState({
          liveMode: parts[1] === "1",
          targetValue: parseInt(parts[2]) || 0,
          outputValue: parseInt(parts[3]) || 0,
          failsafe: parts[4] === "1",
        });
      }
      return;
    }

    // Parse PIN_CONF,pin,mode,value
    if (line.startsWith("PIN_CONF,")) {
      const parts = line.split(",");
      if (parts.length >= 3) {
        const pin = parseInt(parts[1]);
        const rawMode = parts[2];
        const mode = ["DISABLED", "LIGHT", "SERVO", "STEERING", "BATTERY", "MOTOR"].includes(rawMode)
          ? (rawMode as PinConfig["mode"])
          : "DISABLED";
        const val = parts.length > 3 ? parseInt(parts[3]) : 0;
        
        setPinConfigs(prev => {
          // Remove existing config for this pin if exists
          const filtered = prev.filter(p => p.pin !== pin);
          return [...filtered, { pin, mode, value: val }].sort((a, b) => a.pin - b.pin);
        });
      }
      return;
    }

    // Parse SERVO_CFG:pin,freq,min,mid,max,src,rev,rate,speed,mode,minAngle,maxAngle,rangeCount
    if (line.startsWith("SERVO_CFG,")) {
      const parts = line.split(",");
      if (parts.length >= 10) {
        const pin = parseInt(parts[1]);
        const mode = parts.length >= 11 ? parseInt(parts[10]) : 0;
        const minAngle = parts.length >= 12 ? parseInt(parts[11]) : 0;
        const maxAngle = parts.length >= 13 ? parseInt(parts[12]) : 180;
        const rangeCount = parts.length >= 14 ? parseInt(parts[13]) : 0;

        setServoConfigs(prev => {
          const idx = prev.findIndex(c => c.pin === pin);
          const currentRanges = idx >= 0 ? prev[idx].ranges : [];
          
          // If rangeCount is specified and smaller than current ranges, truncate them
          // to match firmware's state
          let newRanges = [...currentRanges];
          if (parts.length >= 14 && rangeCount < newRanges.length) {
              newRanges = newRanges.slice(0, rangeCount);
          }

          const newCfg: ServoConfig = {
            pin,
            frequency: parseInt(parts[2]),
            minUs: parseInt(parts[3]),
            midUs: parseInt(parts[4]),
            maxUs: parseInt(parts[5]),
            sourceChannel: parseInt(parts[6]),
            reverse: parts[7] === "1",
            rate: parseFloat(parts[8]),
            speed: parseInt(parts[9]),
            mode,
            minAngle,
            maxAngle,
            ranges: newRanges,
          };

          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = newCfg;
            return copy;
          }
          return [...prev, newCfg].sort((a, b) => a.pin - b.pin);
        });
      }
      return;
    }

    // Parse SERVO_RNG:pin,idx,minIn,maxIn,targetUs
    if (line.startsWith("SERVO_RNG,")) {
      const parts = line.split(",");
      if (parts.length >= 6) {
        const pin = parseInt(parts[1]);
        const rIdx = parseInt(parts[2]);
        if (rIdx < 0 || rIdx > 20) return; // Safety check
        const minIn = parseInt(parts[3]);
        const maxIn = parseInt(parts[4]);
        const targetUs = parseInt(parts[5]);

        setServoConfigs(prev => {
          const sIdx = prev.findIndex(c => c.pin === pin);
          if (sIdx === -1) return prev;

          const newConfigs = [...prev];
          const servo = { ...newConfigs[sIdx] };
          const newRanges = [...(servo.ranges || [])];

          // Expand array if needed
          while (newRanges.length <= rIdx) {
            newRanges.push({ minIn: 0, maxIn: 0, targetUs: 1500 });
          }

          newRanges[rIdx] = { minIn, maxIn, targetUs };
          servo.ranges = newRanges;
          newConfigs[sIdx] = servo;
          return newConfigs;
        });
      }
      return;
    }

    // Parse SERVO_POS,pin,us
    if (line.startsWith("SERVO_POS,")) {
      const parts = line.split(",");
      if (parts.length >= 3) {
        const pin = parseInt(parts[1]);
        const us = parseInt(parts[2]);
        if (!Number.isNaN(pin) && !Number.isNaN(us)) {
          setPinConfigs(prev => {
            const existing = prev.find(p => p.pin === pin);
            const mode = existing?.mode ?? "SERVO";
            const filtered = prev.filter(p => p.pin !== pin);
            return [...filtered, { pin, mode, value: us }].sort((a, b) => a.pin - b.pin);
          });
        }
      }
      return;
    }

    // Parse Module Status: MODULE_STATUS,GPS,1 or MODULE_STATUS,RECEIVER,0
    if (line.startsWith("MODULE_STATUS,")) {
      const parts = line.split(",");
      if (parts.length >= 3) {
        const moduleName = parts[1];
        const enabled = parts[2] === "1";
        setModuleStates(prev => {
          const newStates = { ...prev };
          if (moduleName === "GPS") newStates.gps = enabled;
          if (moduleName === "RECEIVER") newStates.receiver = enabled;
          return newStates;
        });
      }
      return;
    }

    // Parse Device info: DEVICE,type,version
    if (line.startsWith("DEVICE,")) {
      const parts = line.split(",");
      if (parts.length >= 3) {
        const devType = parts[1] || "esp32c3";
        const version = parts[2] || "1.0.0";
        setDeviceInfo({
          configurator: "1.0.0",
          firmware: version,
          target: devType,
        });
      }
      return;
    }

    // Parse GPS Data: GPS_FULL,fix,sats,lat,lon,alt,speed(km/h),course,hdop
    if (line.startsWith("GPS_FULL,")) {
      const parts = line.split(",");
      if (parts.length >= 9) {
        const fix = parts[1] === "1";
        let numSat = parseInt(parts[2]) || 0;
        if (numSat > 50) numSat = 50; // Safety cap to prevent OOM
        const lat = parseFloat(parts[3]) || 0;
        const lon = parseFloat(parts[4]) || 0;
        const alt = parseFloat(parts[5]) || 0;
        const spd = parseFloat(parts[6]) || 0;
        const hdg = parseFloat(parts[7]) || 0;
        const dop = parseFloat(parts[8]) || 0;

        setGpsData(prev => {
          // Keep existing satellites if we don't have new detailed data
          const sats = prev?.satellites ?? [];

          return {
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
          };
        });
      }
      return;
    }

    // Parse SAT_INFO,count - start collecting satellite data
    if (line.startsWith("SAT_INFO,")) {
      const count = parseInt(line.split(",")[1]) || 0;
      setPendingSatCount(count);
      pendingSatsRef.current = [];
      return;
    }

    // Parse SAT,gnssId,svId,cno,used(0/1),quality
    if (line.startsWith("SAT,")) {
      const parts = line.split(",");
      if (parts.length >= 6) {
        const sat: GpsSatellite = {
          gnssId: parts[1],
          satId: parseInt(parts[2]) || 0,
          signalStrength: parseInt(parts[3]) || 0,
          status: parts[4] === "1" ? "used" as const : "unused" as const,
          quality: parts[5].trim() as GpsSatellite["quality"],
        };
        pendingSatsRef.current.push(sat);
        
        // When we've received all satellites, update gpsData
        if (pendingSatsRef.current.length >= pendingSatCount) {
          const sats = [...pendingSatsRef.current];
          setGpsData(prev => prev ? { ...prev, satellites: sats } : null);
          pendingSatsRef.current = [];
          setPendingSatCount(0);
        }
      }
      return;
    }

    // Parse RX settings: RX_SETTINGS,map,rcmin,rcmid,rcmax,db_rc,db_yaw,db_thr3d,rc_smooth,rc_coeff,steer_ch,thr_ch,steer_rev,thr_rev[,control_mode,dir_ch,speed_ch,dir_pol]
    if (line.startsWith("RX_SETTINGS,")) {
      const parts = line.split(",");
      if (parts.length >= 14) {
        const ctrlMode = parts.length >= 15 ? (parts[14] as "PROPORTIONAL" | "DIRECTION_SELECTED") : "PROPORTIONAL";
        const dirCh = parts.length >= 16 ? parseInt(parts[15]) || 1 : 1;
        const spdCh = parts.length >= 17 ? parseInt(parts[16]) || 2 : 2;
        const dirPol = parts.length >= 18 ? parts[17] === "1" : false;
        setReceiverSettings({
          controlMode: ctrlMode,
          directionChannel: dirCh,
          speedChannel: spdCh,
          directionPressedIsReverse: dirPol,
          channelMap: parts[1],
          rcMin: parseInt(parts[2]) || 1000,
          rcMid: parseInt(parts[3]) || 1500,
          rcMax: parseInt(parts[4]) || 2000,
          deadbandRc: parseInt(parts[5]) || 0,
          deadbandYaw: parseInt(parts[6]) || 0,
          deadbandThr3d: parseInt(parts[7]) || 0,
          rcSmoothing: parts[8] === "1",
          rcSmoothingCoeff: parseInt(parts[9]) || 30,
          steeringChannel: parseInt(parts[10]) || 1,
          throttleChannel: parseInt(parts[11]) || 2,
          steeringRev: parts[12] === "1",
          throttleRev: parts[13] === "1",
        });
      }
      return;
    }

    // Parse GPS settings: GPS_SETTINGS,protocol,auto,galileo,home,assist,decl
    if (line.startsWith("GPS_SETTINGS,")) {
      const parts = line.split(",");
      if (parts.length >= 7) {
        setGpsSettings({
          protocol: parts[1],
          autoConfig: parts[2] === "1",
          useGalileo: parts[3] === "1",
          setHomeOnce: parts[4] === "1",
          groundAssistance: parts[5],
          declination: parseFloat(parts[6]) || 0.0,
        });
      }
      return;
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
        return;
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

    if (data === "SET_GPS_MODULE:0") {
      setModuleStates(prev => ({ ...prev, gps: false }));
    } else if (data === "SET_GPS_MODULE:1") {
      setModuleStates(prev => ({ ...prev, gps: true }));
    }

    writeChainRef.current = writeChainRef.current.then(async () => {
      let writer: any = null;
      try {
        writer = portRef.current.writable.getWriter();
        const encoded = new TextEncoder().encode(data + "\n");
        await writer.write(encoded);
        setLastSent(`TX: ${data}`);
        pendingLogsRef.current.push(`> ${data}\n`);
      } catch (err: any) {
        console.error("Send error:", err);
        pendingLogsRef.current.push(`Error sending: ${err}\n`);
      } finally {
        try {
          if (writer) writer.releaseLock();
        } catch {}
      }
    });
    return writeChainRef.current;
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
        
        pendingLogsRef.current.push(text);
        
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
        pendingLogsRef.current.push(`[System] Connection lost - device may have reset\n`);
      } else {
        console.error("Serial read error:", err);
        pendingLogsRef.current.push(`Serial read error: ${err.message}\n`);
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

      // Try to disable telemetry before closing if still possible
      if (portRef.current && portRef.current.writable) {
        try {
           // We don't want to wait too long for this, but let's try to send it
           const writer = portRef.current.writable.getWriter();
           const encoded = new TextEncoder().encode("DISABLE_ALL_TELEMETRY\n");
           await writer.write(encoded);
           writer.releaseLock();
        } catch (e) {
           console.log("Could not send disable telemetry command before closing");
        }
      }
      
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
    pendingLogsRef.current.push(`[System] Disconnected\n`);
    bufferRef.current = "";
    writeChainRef.current = Promise.resolve();
    setMotorConfig(null);
    setMotorState(null);
  }, []);

  const connect = useCallback(async (baudRate: number = 115200) => {
    const openPortWithTimeout = (port: any, timeoutMs: number) =>
      new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error("Timeout podczas otwierania portu szeregowego"));
        }, timeoutMs);

        port
          .open({ baudRate })
          .then(() => {
            clearTimeout(timeoutId);
            resolve();
          })
          .catch((error: any) => {
            clearTimeout(timeoutId);
            reject(error);
          });
      });

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
      await openPortWithTimeout(port, 5000);

      portRef.current = port;
      setConnected(true);
      setLastSent("Connected to serial port");
      pendingLogsRef.current.push(`[System] Connected at ${baudRate} baud\n`);
      localStorage.setItem("lastBaudRate", baudRate.toString());
      bufferRef.current = "";

      if (port.readable) {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        readLoop(reader);
      }

      // Send FULL_CONFIG request immediately after connection
      setTimeout(() => {
        send("FULL_CONFIG");
      }, 500);

    } catch (err: any) {
      if (err.name === "SecurityError") {
        alert("Web Serial is blocked in an iframe. Open the page in a new tab.");
      } else if (err.name === "NotFoundError") {
        console.log("User cancelled port selection");
      } else if (err.name === "NetworkError") {
        alert("Port szeregowy jest już używany przez inną aplikację lub nie jest dostępny.");
        pendingLogsRef.current.push(`[Error] Port unavailable - may be in use by another application\n`);
      } else {
        console.error("Serial connection error:", err);
        pendingLogsRef.current.push(`Connection error: ${err.message}\n`);
        alert("Błąd połączenia: " + err.message);
      }

      setConnected(false);
      portRef.current = null;
    }
  }, [readLoop, send, connected, disconnect]);

  useEffect(() => {
    const shouldOnce = localStorage.getItem("shouldAutoConnect") === "true";
    const autoEnabled = localStorage.getItem("autoConnectEnabled") === "true";
    if (!shouldOnce && !autoEnabled) return;
    if (shouldOnce) localStorage.removeItem("shouldAutoConnect");
    const lastBaud = parseInt(localStorage.getItem("lastBaudRate") || "115200");
    
    (async () => {
      if (!("serial" in navigator)) return;
      await new Promise(resolve => setTimeout(resolve, shouldOnce ? 2000 : 500));
      try {
        const ports = await (navigator as any).serial.getPorts();
        if (ports.length > 0) {
          const port = ports[0];
          await port.open({ baudRate: lastBaud });
          portRef.current = port;
          setConnected(true);
          setLastSent(shouldOnce ? "Auto-connected after restart" : "Auto-connected");
          pendingLogsRef.current.push(`[System] Auto-connected at ${lastBaud} baud${shouldOnce ? " after restart" : ""}\n`);
          bufferRef.current = "";
          
          if (port.readable) {
            const reader = port.readable.getReader();
            readerRef.current = reader;
            readLoop(reader);
          }
          
          setTimeout(() => {
            send("FULL_CONFIG");
          }, 500);
        } else {
          pendingLogsRef.current.push(`[System] No serial ports available for auto-connect\n`);
        }
      } catch (err:any) {
        console.error("Auto-connect error:", err);
        pendingLogsRef.current.push(`Auto-connect error: ${err?.message || err}\n`);
      }
    })();
  }, [readLoop, send]);

  useEffect(() => {
    // Mock GPS data disabled, real parsing implemented
    // if (connected) { ... }
  }, [connected]);

  const reboot = useCallback(async () => {
    await send("REBOOT");
    // Daj czas na wysłanie komendy i restart ESP
    setTimeout(async () => {
      await disconnect();
      // Opcjonalnie: można spróbować auto-reconnect po np. 3 sekundach, 
      // ale przeglądarki często wymagają gestu użytkownika do ponownego otwarcia portu.
      // Lepiej po prostu rozłączyć i pozwolić użytkownikowi kliknąć Connect.
    }, 500);
  }, [disconnect, send]);

  return {
    connected,
    deviceInfo,
    lastSent,
    uartConfigs,
    pinConfigs,
    receiverData,
    logs,
    gpsData,
    receiverSettings,
    gpsSettings,
    batteryConfig,
    motorConfig,
    motorState,
    servoConfigs,
    moduleStates,
    connect,
    disconnect,
    send,
    reboot
  };
}
