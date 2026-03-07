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

      {/* GPS Signal Strength Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <Signal size={14} className="text-primary" />
          <span className="text-xs font-semibold text-foreground">GPS Signal Strength</span>
          <span className="text-[10px] text-muted-foreground ml-auto">{data?.satellites?.length ?? 0} tracked</span>
        </div>
        <div className="p-0 overflow-auto max-h-[350px]">
          {(data?.satellites?.length ?? 0) === 0 ? (
            <div className="flex items-center justify-center text-xs text-muted-foreground p-8 border border-dashed border-border/20 m-4 rounded-md">
              No satellites tracked
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Gnss ID</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Sat ID</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Signal Strength</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Status</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Quality</th>
                </tr>
              </thead>
              <tbody>
                {data?.satellites?.map((sat, i) => {
                  const barPct = Math.min(100, (sat.signalStrength / 50) * 100);
                  const isGood = sat.signalStrength >= 35;
                  const isMedium = sat.signalStrength >= 25;
                  const barColor = sat.status === 'unused' && sat.quality === 'unusable'
                    ? 'bg-muted-foreground/40'
                    : isGood
                      ? 'bg-[hsl(var(--sensor-ok))]'
                      : isMedium
                        ? 'bg-[hsl(var(--sensor-ok))]/70'
                        : 'bg-muted-foreground/40';

                  const statusBg = sat.status === 'used'
                    ? 'bg-[hsl(var(--sensor-ok))] text-[hsl(var(--sensor-ok-foreground,0,0%,0%))]'
                    : 'bg-destructive text-destructive-foreground';

                  const qualityBg = sat.quality === 'fully_locked' || sat.quality === 'fully locked'
                    ? 'bg-[hsl(var(--sensor-ok))] text-[hsl(var(--sensor-ok-foreground,0,0%,0%))]'
                    : sat.quality === 'searching'
                      ? 'bg-[hsl(45,100%,50%)] text-[hsl(0,0%,0%)]'
                      : sat.quality === 'unusable' || sat.quality === 'no_signal'
                        ? 'bg-destructive text-destructive-foreground'
                        : 'bg-muted text-muted-foreground';

                  return (
                    <tr key={i} className="border-b border-border/10 hover:bg-muted/10 transition-colors">
                      <td className="px-3 py-1.5 font-mono text-foreground">{sat.gnssId}</td>
                      <td className="px-3 py-1.5 text-center font-mono text-foreground">{sat.satId}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden">
                            <div className={`h-full rounded-sm ${barColor}`} style={{ width: `${barPct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusBg}`}>
                          {sat.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${qualityBg}`}>
                          {sat.quality}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
