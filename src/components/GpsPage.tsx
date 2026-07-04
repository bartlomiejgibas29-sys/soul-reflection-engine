import { useState, useEffect } from "react";
import type { GpsData, GpsSettings } from "@/hooks/useSerial";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MapPin, Signal, Satellite, Compass, RefreshCw, Globe, Sparkles } from "lucide-react";
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
    onSend("SET_GPS_MODULE:1");
    onSend("GPS_SETTINGS");
  }, []);

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto p-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/40 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.10),_transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary/80">BetaDrive</p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">GPS</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Konfiguracja modułu GPS, statusu pozycji, sygnału i mapy lokalizacji.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onSend("GPS_SETTINGS")} className="border-border/50 bg-background/70">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/40 shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <Compass size={14} className="text-primary" />
                <span className="text-xs font-semibold text-foreground">Configuration</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                <Sparkles size={10} />
                GNSS
              </div>
            </div>
            <div className="space-y-3 p-4">
              <SettingRow label="Protocol">
                <Select value={protocol} onValueChange={(v) => { setProtocol(v); onSend(`SET_GPS_PROTOCOL:${v}`); }}>
                  <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
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
                  className="h-9 w-24 text-right font-mono text-xs"
                />
              </SettingRow>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/40 shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <Signal size={14} className="text-primary" />
                <span className="text-xs font-semibold text-foreground">Satellite Signal</span>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-[hsl(0,0%,10%)] p-0">
              {(data?.satellites?.length ?? 0) === 0 ? (
                <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
                  No satellites tracked
                </div>
              ) : (
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-[hsl(0,0%,10%)]">
                    <tr>
                      <th className="border-b border-gray-700/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-300">GNSS</th>
                      <th className="border-b border-gray-700/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-300">Sat</th>
                      <th className="border-b border-gray-700/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-300">Signal</th>
                      <th className="border-b border-gray-700/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.satellites?.map((sat, i) => {
                      const isUsed = sat.status === 'used';
                      const statusBg = isUsed ? 'bg-emerald-600' : (sat.gnssId === 'SBAS' ? 'bg-amber-600' : 'bg-rose-600');
                      return (
                        <tr key={i} className="border-b border-gray-700/40 text-xs text-gray-200 hover:bg-white/5">
                          <td className="px-4 py-2">{sat.gnssId}</td>
                          <td className="px-4 py-2">{sat.satId}</td>
                          <td className="px-4 py-2">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                              <div className={`h-full rounded-full ${sat.signalStrength > 30 ? 'bg-emerald-500' : 'bg-gray-400'}`} style={{ width: `${Math.min(100, (sat.signalStrength / 50) * 100)}%` }} />
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase text-white ${statusBg}`}>
                              {sat.status}
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
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/40 shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
            <div className="flex items-center gap-2 border-b border-border/40 bg-muted/20 px-4 py-3">
              <Satellite size={14} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">Live Status</span>
              <div className="ml-auto flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${data?.fix ? 'bg-green-600 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[10px] font-medium text-muted-foreground">{data?.fix ? '3D FIX' : 'NO FIX'}</span>
              </div>
            </div>
            <div className="space-y-1.5 p-4">
              {!data && (
                <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  No GPS data detected — verify UART mapping on the Ports page.
                </div>
              )}
              <InfoRow label="3D Fix" value={data?.fix ? "Yes" : "No"} valueColor={data?.fix ? "text-[hsl(var(--sensor-ok))]" : "text-destructive"} />
              <InfoRow label="Satellites" value={`${data?.numSatellites ?? 0}`} />
              <InfoRow label="Altitude" value={`${data?.altitude ?? 0} m`} />
              <InfoRow label="Speed" value={`${data?.speed ?? 0} km/h`} />
              <InfoRow label="Heading (GPS)" value={`${data?.headingGps ?? 0}°`} />
              <InfoRow label="Position" value={data?.latitude ? `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}` : "—"} valueColor="text-primary" />
              <InfoRow label="Dist to Home" value={`${data?.distToHome ?? 0} m`} />
              <InfoRow label="DOP" value={(data?.dop ?? 0).toFixed(2)} />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/40 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-primary" />
                <span className="text-xs font-semibold text-foreground">Location</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {data?.fix ? `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}` : "Waiting for fix..."}
              </span>
            </div>
            <div className="h-[280px]">
              {data?.fix ? (
                <MapContainer {...{ center: [data.latitude, data.longitude], zoom: 18 } as any} className="h-full w-full">
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                  <CircleMarker {...{ center: [data.latitude, data.longitude], radius: 10, pathOptions: { color: "#f59e0b" } } as any} />
                </MapContainer>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[hsl(0,0%,8%)]">
                  <div className="space-y-2 text-center">
                    <MapPin size={32} className="mx-auto text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground">No fix — move outside for satellite visibility</p>
                  </div>
                </div>
              )}
            </div>
          </div>
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