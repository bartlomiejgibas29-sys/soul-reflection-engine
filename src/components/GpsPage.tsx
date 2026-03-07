import { useState, useEffect } from "react";
import type { GpsData, GpsSettings } from "@/hooks/useSerial";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation, Signal, Satellite, Compass, RefreshCw, Globe } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface GpsPageProps {
  data: GpsData | null;
  settings: GpsSettings | null;
  onSend: (data: string) => Promise<void> | void;
}

const InfoRow = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-border/10 last:border-0">
    <span className="text-muted-foreground text-xs">{label}</span>
    <span className={`font-mono text-xs font-semibold ${valueColor || "text-foreground"}`}>{value}</span>
  </div>
);

const GpsPage = ({ data, settings, onSend }: GpsPageProps) => {
  const [protocol, setProtocol] = useState("UBLOX");
  const [autoConfig, setAutoConfig] = useState(true);
  const [useGalileo, setUseGalileo] = useState(true);
  const [setHomeOnce, setSetHomeOnce] = useState(true);
  const [groundAssist, setGroundAssist] = useState("European");
  const [declination, setDeclination] = useState("0.0");

  useEffect(() => {
    if (settings) {
      setProtocol(settings.protocol);
      setAutoConfig(settings.autoConfig);
      setUseGalileo(settings.useGalileo);
      setSetHomeOnce(settings.setHomeOnce);
      setGroundAssist(settings.groundAssistance);
      setDeclination(settings.declination.toString());
    }
  }, [settings]);

  useEffect(() => {
    onSend("ENABLE_GPS_MODE");
    onSend("GPS_SETTINGS");
    return () => { onSend("DISABLE_GPS_MODE"); };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full overflow-y-auto">
      
      {/* GPS Configuration */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Compass size={14} className="text-primary" />
            <span className="text-xs font-semibold text-foreground">GPS Configuration</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onSend("GPS_SETTINGS")}>
            <RefreshCw size={12} />
          </Button>
        </div>
        <div className="p-4 space-y-3">
          <SettingRow label="Protocol">
            <Select value={protocol} onValueChange={(v) => { setProtocol(v); onSend(`SET_GPS_PROTOCOL:${v}`); }}>
              <SelectTrigger className="w-[120px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UBLOX">UBLOX</SelectItem>
                <SelectItem value="NMEA">NMEA</SelectItem>
                <SelectItem value="MSP">MSP</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="Auto Config">
            <Switch checked={autoConfig} onCheckedChange={(v) => { setAutoConfig(v); onSend(`SET_GPS_AUTO_CONFIG:${v ? 1 : 0}`); }} />
          </SettingRow>

          <SettingRow label="Use Galileo">
            <Switch checked={useGalileo} onCheckedChange={(v) => { setUseGalileo(v); onSend(`SET_GPS_GALILEO:${v ? 1 : 0}`); }} />
          </SettingRow>

          <SettingRow label="Set Home Once">
            <Switch checked={setHomeOnce} onCheckedChange={(v) => { setSetHomeOnce(v); onSend(`SET_GPS_HOME_ONCE:${v ? 1 : 0}`); }} />
          </SettingRow>

          <SettingRow label="Ground Assistance">
            <Select value={groundAssist} onValueChange={(v) => { setGroundAssist(v); onSend(`SET_GPS_GROUND_ASSIST:${v}`); }}>
              <SelectTrigger className="w-[140px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="European">European EGNOS</SelectItem>
                <SelectItem value="USA">USA WAAS</SelectItem>
                <SelectItem value="None">None</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="Mag Declination (°)">
            <Input
              value={declination}
              onChange={e => setDeclination(e.target.value)}
              onBlur={e => onSend(`SET_GPS_MAG_DECLINATION:${e.target.value}`)}
              className="w-20 h-7 text-xs font-mono text-right"
            />
          </SettingRow>
        </div>
      </div>

      {/* GPS Status */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <Satellite size={14} className="text-primary" />
          <span className="text-xs font-semibold text-foreground">GPS Status</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className={`w-1.5 h-1.5 rounded-full ${data?.fix ? 'bg-[hsl(var(--sensor-ok))] animate-pulse' : 'bg-destructive'}`} />
            <span className="text-[10px] text-muted-foreground">{data?.fix ? '3D FIX' : 'NO FIX'}</span>
          </div>
        </div>
        <div className="p-4">
          {!data && (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              No GPS data detected — not connected or wrong port. Verify UART configuration on the Ports page.
            </div>
          )}
          <InfoRow label="3D Fix" value={data?.fix ? "Yes" : "No"} valueColor={data?.fix ? "text-[hsl(var(--sensor-ok))]" : "text-destructive"} />
          <InfoRow label="Satellites" value={`${data?.numSatellites ?? 0}`} />
          <InfoRow label="Altitude" value={`${data?.altitude ?? 0} m`} />
          <InfoRow label="Speed" value={`${data?.speed ?? 0} cm/s`} />
          <InfoRow label="Heading (GPS)" value={`${data?.headingGps ?? 0}°`} />
          <InfoRow label="Position" value={data?.latitude ? `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}` : "—"} valueColor="text-primary" />
          <InfoRow label="Dist to Home" value={`${data?.distToHome ?? 0} m`} />
          <InfoRow label="DOP" value={(data?.dop ?? 0).toFixed(2)} />
        </div>
      </div>

      {/* Satellite Signal Strength (Betaflight style) */}
      <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col h-[300px]">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <Signal size={14} className="text-primary" />
          <span className="text-xs font-semibold text-foreground">Satellite Signal (C/N0)</span>
          <span className="text-[10px] text-muted-foreground ml-auto">{data?.satellites?.length ?? 0} tracked</span>
        </div>
        <div className="flex-1 p-4 flex flex-col min-h-0">
          {(data?.satellites?.length ?? 0) === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border/20 rounded-md">
              No satellites tracked
            </div>
          ) : (
            <div className="flex-1 flex items-end gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
              {data?.satellites?.map((sat, i) => {
                const heightPct = Math.min(100, (sat.signalStrength / 50) * 100); // Assume 50 dB-Hz is max
                const isGood = sat.signalStrength >= 35;
                const isMedium = sat.signalStrength >= 25;
                
                return (
                  <div key={i} className="flex flex-col items-center gap-1 group h-full justify-end min-w-[24px]">
                    <span className="text-[9px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                      {sat.signalStrength}
                    </span>
                    <div className="w-4 bg-[hsl(0,0%,8%)] rounded-t-sm border border-border/30 relative flex-1 flex flex-col justify-end overflow-hidden">
                      <div
                        className={`w-full transition-all duration-300 rounded-t-[1px] ${
                          sat.status === 'unused' 
                            ? 'bg-muted-foreground/30' 
                            : isGood 
                              ? 'bg-[hsl(var(--sensor-ok))]' 
                              : isMedium 
                                ? 'bg-primary' 
                                : 'bg-destructive'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-bold font-mono ${sat.status === 'used' ? 'text-primary' : 'text-muted-foreground'}`}>
                      {sat.satId}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-2 flex items-center justify-center gap-4 text-[9px] text-muted-foreground uppercase tracking-tighter font-medium border-t border-border/10 pt-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--sensor-ok))]" />
              <span>Locked (&gt;35dB)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Weak (&gt;25dB)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span>Unusable</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              <span>Ignored</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col h-[300px] relative">
        <div className="absolute top-0 left-0 right-0 px-4 py-2 bg-background/80 backdrop-blur-sm z-10 flex justify-between items-center border-b border-border">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-primary" />
            <span className="text-xs font-semibold text-foreground">Location</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            {data?.fix ? `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}` : "Waiting for fix..."}
          </span>
        </div>
        <div className="flex-1">
          {data?.fix ? (
            <MapContainer
              {...{ center: [data.latitude, data.longitude], zoom: 18 } as any}
              className="w-full h-full"
            >
              <TileLayer {...{ url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" } as any} />
              <CircleMarker {...{ center: [data.latitude, data.longitude], radius: 10, pathOptions: { color: "#f59e0b" } } as any} />
            </MapContainer>
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-[hsl(0,0%,8%)]">
              <div className="text-center space-y-2">
                <MapPin size={32} className="text-muted-foreground/20 mx-auto" />
                <p className="text-xs text-muted-foreground">No fix — move outside for satellite visibility</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SettingRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default GpsPage;
