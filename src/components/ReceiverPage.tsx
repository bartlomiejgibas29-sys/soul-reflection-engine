import { useEffect, useState, useCallback } from "react";
import type { ReceiverData, ReceiverSettings } from "@/hooks/useSerial";
import { Radio, Signal, Zap, Antenna, Activity, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ReceiverPageProps {
  data: ReceiverData | null;
  settings: ReceiverSettings | null;
  onSend: (data: string) => Promise<void> | void;
}

// --- KOMPONENTY POMOCNICZE ---

const ChannelBar = ({ label, value, color, accent }: { label: string; value: number; color: string; accent?: boolean }) => {
  const percentage = Math.max(0, Math.min(100, ((value - 1000) / 1000) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className={`w-[80px] text-right font-mono text-xs shrink-0 ${accent ? 'text-foreground font-bold' : 'text-muted-foreground font-medium'}`}>
        {label}
      </div>
      <div className="flex-1 h-7 bg-[hsl(0,0%,10%)] rounded-md overflow-hidden relative border border-border/40">
        <div
          className={`absolute top-0.5 bottom-0.5 left-0 transition-all duration-75 ease-out rounded-sm ${color}`}
          style={{ width: `${percentage}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-foreground font-mono z-20 drop-shadow-sm mix-blend-difference">
          {value}
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ icon: Icon, label, value, unit, color }: {
  icon?: any; label: string; value: string; unit?: string; color?: string;
}) => (
  <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-[hsl(0,0%,10%)] border border-border/20">
    {Icon && <Icon size={13} className={color || "text-muted-foreground"} />}
    <div className="flex-1">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
    <div className="text-right">
      <span className="font-mono text-sm text-foreground font-semibold">{value}</span>
      {unit && <span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span>}
    </div>
  </div>
);

// --- GŁÓWNY KOMPONENT ---

const ReceiverPage = ({ data, settings, onSend }: ReceiverPageProps) => {
  // 1. Inicjalizacja trybu Odbiornika przy wejściu na stronę
  useEffect(() => {
    onSend("ENABLE_RECEIVER_MODE");
    onSend("RX_SETTINGS"); // Pobierz ustawienia od razu
    return () => { onSend("DISABLE_RECEIVER_MODE"); };
  }, []);

  // 2. Lokalny stan formularza (aby UI był szybki i responsywny)
  // Używamy "null" jako sygnału, że dane jeszcze nie dotarły z kontrolera
  const [form, setForm] = useState<ReceiverSettings | null>(null);

  // 3. Synchronizacja: Gdy przyjdą nowe 'settings' z zewnątrz (z useSerial), zaktualizuj formularz
  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  // 4. Funkcje obsługi zmian w formularzu
  // Zmieniają stan lokalny natychmiast, a potem wysyłają komendę
  
  const handleSwitchChange = (key: keyof ReceiverSettings, cmdPrefix: string, checked: boolean) => {
    setForm(prev => prev ? { ...prev, [key]: checked } : null);
    onSend(`${cmdPrefix}:${checked ? 1 : 0}`);
  };

  const handleSelectChange = (key: keyof ReceiverSettings, cmdPrefix: string, value: string) => {
    // Niektóre selecty są liczbami (RSSI Channel), inne stringami (Map)
    const numVal = parseInt(value);
    const finalVal = isNaN(numVal) ? value : numVal;
    
    setForm(prev => prev ? { ...prev, [key]: finalVal } : null);
    onSend(`${cmdPrefix}:${value}`);
  };

  const handleInputChange = (key: keyof ReceiverSettings, value: string) => {
    const numVal = parseInt(value);
    if (isNaN(numVal)) return;
    setForm(prev => prev ? { ...prev, [key]: numVal } : null);
  };

  const handleInputBlur = (cmdPrefix: string, value: number | undefined) => {
    if (value === undefined) return;
    onSend(`${cmdPrefix}:${value}`);
  };

  // Car Channels
  const steeringCh = form?.steeringChannel ?? 1; // Default CH1
  const throttleCh = form?.throttleChannel ?? 2; // Default CH2
  
  // Mapping for Visualization (based on user selection)
  const channels = data?.channels || Array(16).fill(1500);
  const steering = channels[steeringCh - 1] || 1500;
  const throttle = channels[throttleCh - 1] || 1500;

  const COLORS = {
    steering: "bg-blue-500",
    throttle: "bg-green-500",
    aux: "bg-slate-600",
  };

  // Jeśli nie mamy jeszcze ustawień, wyświetl loading (lub puste, ale interaktywne po załadowaniu)
  const isLoaded = !!form;

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto p-1">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        
        {/* LEWA KOLUMNA: MONITOR KANAŁÓW (RC CAR STYLE) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">Car Control Monitor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${data ? 'bg-[hsl(120,60%,50%)] animate-pulse' : 'bg-muted-foreground'}`} />
              <span className="text-[10px] text-muted-foreground">{data ? 'LIVE' : 'NO DATA'}</span>
            </div>
          </div>

          <div className="p-4 space-y-6 overflow-y-auto flex-1">
            {/* Steering Visualization */}
            <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-muted-foreground uppercase">
                    <span>Left</span>
                    <span>Steering</span>
                    <span>Right</span>
                </div>
                <div className="relative h-6 bg-secondary/50 rounded-full overflow-hidden border border-border/30">
                    {/* Center Marker */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-foreground/20 -translate-x-1/2 z-10"></div>
                    {/* Bar */}
                    <div 
                        className="absolute top-0 bottom-0 bg-blue-500 transition-all duration-75 ease-out"
                        style={{
                            left: steering < 1500 ? `${((steering - 1000) / 1000) * 100}%` : '50%',
                            right: steering > 1500 ? `${100 - ((steering - 1000) / 1000) * 100}%` : '50%',
                        }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-foreground drop-shadow-md">
                        {steering}
                    </div>
                </div>
            </div>

            {/* Throttle Visualization */}
            <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-muted-foreground uppercase">
                    <span>Brake/Rev</span>
                    <span>Throttle</span>
                    <span>Fwd</span>
                </div>
                <div className="relative h-6 bg-secondary/50 rounded-full overflow-hidden border border-border/30">
                     {/* Center Marker */}
                     <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-foreground/20 -translate-x-1/2 z-10"></div>
                    {/* Bar */}
                    <div 
                        className={`absolute top-0 bottom-0 transition-all duration-75 ease-out ${throttle > 1500 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{
                            left: throttle < 1500 ? `${((throttle - 1000) / 1000) * 100}%` : '50%',
                            right: throttle > 1500 ? `${100 - ((throttle - 1000) / 1000) * 100}%` : '50%',
                        }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-foreground drop-shadow-md">
                        {throttle}
                    </div>
                </div>
            </div>

            <div className="border-t border-border/20 my-2" />
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {channels.slice(4).map((val, idx) => (
                <div key={`aux-${idx}`} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-8">AUX{idx+1}</span>
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-slate-500" style={{ width: `${((val - 1000) / 1000) * 100}%` }}></div>
                    </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PRAWA KOLUMNA: STATYSTYKI I USTAWIENIA */}
        <div className="space-y-3">
          
          {/* STATYSTYKI ELRS (Uplink/Downlink) */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <Signal size={13} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">Link Statistics</span>
            </div>
            <div className="p-2 space-y-1.5">
              <StatItem icon={Antenna} label="RSSI (dBm)" value={data ? `${data.uplinkRSS1}` : "—"} />
              <StatItem icon={Activity} label="Link Quality" value={data ? `${data.uplinkLQ}` : "—"} unit="%" color="text-[hsl(120,60%,50%)]" />
              <StatItem icon={Zap} label="TX Power" value={data ? `${data.uplinkTXPower}` : "—"} unit="mW" />
            </div>
          </div>

          {/* USTAWIENIA ODBIORNIKA */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Radio size={13} className="text-primary" />
                <span className="text-xs font-semibold text-foreground">Car Settings</span>
              </div>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onSend("RX_SETTINGS")} title="Odśwież ustawienia">
                <RefreshCw size={12} />
              </Button>
            </div>
            
            <div className="p-4 space-y-4 text-xs">
              
              {/* 1. Steering Channel & Reverse */}
              <div className="flex items-center justify-between">
                <Label className="text-xs font-normal">Steering Channel</Label>
                <div className="flex items-center gap-2">
                    <Select 
                      value={(form?.steeringChannel ?? 1).toString()} 
                      onValueChange={(v) => handleSelectChange("steeringChannel", "SET_STEER_CH", v)}
                      disabled={!isLoaded}
                    >
                      <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 16 }).map((_, i) => (
                          <SelectItem key={i} value={(i + 1).toString()}>CH {i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 border border-border rounded px-1.5 h-7">
                        <Label className="text-[10px] text-muted-foreground">REV</Label>
                        <Switch 
                            className="scale-75 origin-right"
                            checked={form?.steeringRev ?? false} 
                            onCheckedChange={(v) => handleSwitchChange("steeringRev", "SET_STEER_REV", v)} 
                            disabled={!isLoaded}
                        />
                    </div>
                </div>
              </div>

              {/* 2. Throttle Channel & Reverse */}
              <div className="flex items-center justify-between">
                <Label className="text-xs font-normal">Throttle Channel</Label>
                <div className="flex items-center gap-2">
                    <Select 
                      value={(form?.throttleChannel ?? 2).toString()} 
                      onValueChange={(v) => handleSelectChange("throttleChannel", "SET_THR_CH", v)}
                      disabled={!isLoaded}
                    >
                      <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 16 }).map((_, i) => (
                          <SelectItem key={i} value={(i + 1).toString()}>CH {i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 border border-border rounded px-1.5 h-7">
                        <Label className="text-[10px] text-muted-foreground">REV</Label>
                        <Switch 
                            className="scale-75 origin-right"
                            checked={form?.throttleRev ?? false} 
                            onCheckedChange={(v) => handleSwitchChange("throttleRev", "SET_THR_REV", v)} 
                            disabled={!isLoaded}
                        />
                    </div>
                </div>
              </div>

              {/* 4. RC Ranges (Min/Mid/Max) */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Min</Label>
                  <Input 
                    type="number" className="h-7 text-xs" 
                    value={form?.rcMin ?? 1000} 
                    onChange={(e) => handleInputChange("rcMin", e.target.value)}
                    onBlur={() => handleInputBlur("SET_RC_MIN", form?.rcMin)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Mid</Label>
                  <Input 
                    type="number" className="h-7 text-xs" 
                    value={form?.rcMid ?? 1500} 
                    onChange={(e) => handleInputChange("rcMid", e.target.value)}
                    onBlur={() => handleInputBlur("SET_RC_MID", form?.rcMid)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Max</Label>
                  <Input 
                    type="number" className="h-7 text-xs" 
                    value={form?.rcMax ?? 2000} 
                    onChange={(e) => handleInputChange("rcMax", e.target.value)}
                    onBlur={() => handleInputBlur("SET_RC_MAX", form?.rcMax)}
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Zakres wartości drążków. Standardowo 1000-2000us. Mid to środek (1500).
              </p>

              {/* 5. RC Smoothing */}
              <div className="space-y-2 pt-2 border-t border-border/20">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-normal">RC Smoothing</Label>
                  <Switch 
                    checked={form?.rcSmoothing ?? false} 
                    onCheckedChange={(v) => handleSwitchChange("rcSmoothing", "SET_RC_SMOOTH", v)} 
                    disabled={!isLoaded}
                  />
                </div>
                {form?.rcSmoothing && (
                  <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                    <Label className="text-xs text-muted-foreground">Factor</Label>
                    <Input 
                      type="number" className="h-7 w-20 text-xs"
                      value={form?.rcSmoothingCoeff ?? 30}
                      onChange={(e) => handleInputChange("rcSmoothingCoeff", e.target.value)}
                      onBlur={() => handleInputBlur("SET_RC_SMOOTH_COEFF", form?.rcSmoothingCoeff)}
                    />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Wygładzanie ruchów drążków. Przydatne do filmowania ("cinematic"), ale może dodać minimalne opóźnienie.
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiverPage;
