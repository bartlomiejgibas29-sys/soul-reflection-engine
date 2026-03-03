import { useState, useEffect } from "react";
import type { GpsData, GpsSettings } from "@/hooks/useSerial";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation, Signal } from "lucide-react";
import { MapContainer, TileLayer, Marker, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface GpsPageProps {
  data: GpsData | null;
  settings: GpsSettings | null;
  onSend: (data: string) => Promise<void> | void;
}

const GpsPage = ({ data, settings, onSend }: GpsPageProps) => {
  // Config state
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

  const handleRefresh = () => {
    onSend("GPS_SETTINGS");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full overflow-y-auto p-1">
      {/* 1. GPS Configuration */}
      <Card className="p-4 space-y-4 bg-card border-border">
        <div className="flex justify-between items-center border-b border-border pb-2 mb-2">
          <h3 className="font-semibold text-sm text-foreground">GPS Configuration</h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRefresh} title="Refresh Settings">
            <RefreshCw size={14} />
          </Button>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Select value={protocol} onValueChange={(v) => {
              setProtocol(v);
              onSend(`SET_GPS_PROTOCOL:${v}`);
            }}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Protocol" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UBLOX">UBLOX</SelectItem>
                <SelectItem value="NMEA">NMEA</SelectItem>
                <SelectItem value="MSP">MSP</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">Protocol</span>
          </div>

          <div className="flex items-center justify-between">
            <Switch checked={autoConfig} onCheckedChange={(v) => {
              setAutoConfig(v);
              onSend(`SET_GPS_AUTO_CONFIG:${v ? 1 : 0}`);
            }} />
            <span className="text-xs text-muted-foreground">Auto Config</span>
          </div>

          <div className="flex items-center justify-between">
            <Switch checked={useGalileo} onCheckedChange={(v) => {
              setUseGalileo(v);
              onSend(`SET_GPS_GALILEO:${v ? 1 : 0}`);
            }} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Use Galileo</span>
              <span className="text-[10px] text-muted-foreground border rounded px-1">?</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Switch checked={setHomeOnce} onCheckedChange={(v) => {
              setSetHomeOnce(v);
              onSend(`SET_GPS_HOME_ONCE:${v ? 1 : 0}`);
            }} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Set Home Point Once</span>
              <span className="text-[10px] text-muted-foreground border rounded px-1">?</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Select value={groundAssist} onValueChange={(v) => {
              setGroundAssist(v);
              onSend(`SET_GPS_GROUND_ASSIST:${v}`);
            }}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="European">European EGNOS</SelectItem>
                <SelectItem value="USA">USA WAAS</SelectItem>
                <SelectItem value="None">None</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">Ground Assistance Type</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Input 
              value={declination} 
              onChange={e => setDeclination(e.target.value)} 
              onBlur={e => onSend(`SET_GPS_MAG_DECLINATION:${e.target.value}`)}
              className="w-20 h-8 text-xs font-mono text-right"
            />
            <span className="text-xs text-muted-foreground">Magnetometer Declination [deg]</span>
          </div>
        </div>
      </Card>

      {/* 2. GPS Status */}
      <Card className="p-4 space-y-2 bg-card border-border flex flex-col">
        <div className="flex justify-between items-center border-b border-border pb-2 mb-2">
          <h3 className="font-semibold text-sm text-foreground">GPS</h3>
          <span className="text-muted-foreground text-xs">?</span>
        </div>

        <div className="space-y-1 text-xs">
          <StatusRow label="3D Fix:" value={data?.fix ? "True" : "False"} valueColor={data?.fix ? "text-green-500 font-bold" : "text-red-500"} />
          <StatusRow label="Number of Satellites:" value={data?.numSatellites ?? 0} />
          <StatusRow label="Altitude:" value={`${data?.altitude ?? 0} m`} />
          <StatusRow label="Speed:" value={`${data?.speed ?? 0} cm/s`} />
          <StatusRow label="Heading IMU / GPS:" value={`${data?.headingImu ?? 0} / ${data?.headingGps ?? 0} deg`} />
          <StatusRow label="Current Latitude / Longitude:" value={`${data?.latitude?.toFixed(6) ?? 0} / ${data?.longitude?.toFixed(6) ?? 0} deg`} valueColor="text-orange-400" />
          <StatusRow label="Dist to Home:" value={`${data?.distToHome ?? 0} m`} />
          <StatusRow label="Positional DOP:" value={(data?.dop ?? 0).toFixed(2)} />
        </div>
      </Card>

      {/* 3. GPS Signal Strength */}
      <Card className="p-4 space-y-2 bg-card border-border flex flex-col h-[300px]">
        <div className="flex justify-between items-center border-b border-border pb-2 mb-2">
          <h3 className="font-semibold text-sm text-foreground">GPS Signal Strength</h3>
          <span className="text-muted-foreground text-xs">?</span>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground sticky top-0 bg-card z-10">
              <tr>
                <th className="text-left font-normal pb-2">Gnss ID</th>
                <th className="text-center font-normal pb-2">Sat ID</th>
                <th className="text-left font-normal pb-2 w-1/3">Signal Strength</th>
                <th className="text-center font-normal pb-2">Status</th>
                <th className="text-center font-normal pb-2">Quality</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[11px]">
              {(data?.satellites || []).map((sat, i) => (
                <tr key={i} className="border-b border-border/10 last:border-0 hover:bg-white/5">
                  <td className="py-1.5">{sat.gnssId}</td>
                  <td className="text-center">{sat.satId}</td>
                  <td className="pr-2">
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${sat.signalStrength > 50 ? 'bg-green-500' : sat.signalStrength > 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, sat.signalStrength)}%` }}
                      />
                    </div>
                  </td>
                  <td className="text-center">
                    <span className={`px-1.5 py-0.5 rounded ${sat.status === 'used' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                      {sat.status}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className={`px-1.5 py-0.5 rounded ${sat.quality === 'fully locked' ? 'bg-green-900/50 text-green-400' : sat.quality === 'searching' ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                      {sat.quality}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4. Current GPS Location (Satellite Map) */}
      <Card className="p-0 overflow-hidden bg-card border-border flex flex-col h-[300px] relative">
        <div className="absolute top-0 left-0 right-0 p-2 bg-black/60 backdrop-blur-sm z-10 flex justify-between items-center border-b border-white/10">
          <h3 className="font-semibold text-sm text-white">Current GPS location</h3>
          <span className="text-[10px] text-white/70">
            {data && data.fix ? `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}` : "Waiting for fix..."}
          </span>
        </div>
        <div className="flex-1">
          {data && data.fix ? (
            <MapContainer
              {...{ center: [data.latitude, data.longitude], zoom: 18 } as any}
              className="w-full h-full"
            >
              <TileLayer {...{ url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" } as any} />
              <CircleMarker {...{ center: [data.latitude, data.longitude], radius: 10, pathOptions: { color: "#f59e0b" } } as any} />
            </MapContainer>
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-neutral-900">
              <div className="text-xs text-muted-foreground">
                No fix — move outside for better satellite visibility
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

const StatusRow = ({ label, value, valueColor = "text-foreground" }: { label: string; value: string | number; valueColor?: string }) => (
  <div className="flex justify-between items-center border-b border-border/10 py-1 last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono ${valueColor}`}>{value}</span>
  </div>
);

export default GpsPage;
