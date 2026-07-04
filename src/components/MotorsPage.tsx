import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { MotorConfig, MotorState, PinConfig, UartConfig } from "@/hooks/useSerial";
import { formatMotorCommand } from "@/lib/motorCommands";
import { getPinReservationState } from "@/lib/pinReservations";
import { Cable, Gauge, Power, Save, Settings2, ShieldAlert, ToyBrick, Zap } from "lucide-react";

type MotorType = "brushed";
type MotorDriver = "bts7960";

const gpioOptions = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "18", "19"];

interface MotorSettings {
  motorType: MotorType;
  motorDriver: MotorDriver;
  pwmForwardPin: string;
  pwmBackwardPin: string;
  enablePin: string;
  maxPwm: number;
  startupPwm: number;
  pwmFrequency: number;
  rampUpMs: number;
  rampDownMs: number;
  directionChangeMs: number;
  directionSmoothing: number;
}

interface MotorsPageProps {
  connected: boolean;
  config: MotorConfig | null;
  state: MotorState | null;
  uartConfigs: UartConfig[];
  pinConfigs: PinConfig[];
  onSendText: (payload: string) => Promise<void> | void;
}

interface SliderInputRowProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getPinModeLabel = (mode: PinConfig["mode"]) => {
  switch (mode) {
    case "LIGHT":
      return "Light Output";
    case "SERVO":
      return "Servo Output";
    case "STEERING":
      return "Steering";
    case "BATTERY":
      return "Battery Input";
    default:
      return "Feature";
  }
};

const SliderInputRow = ({
  id,
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: SliderInputRowProps) => (
  <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
    <div className="mb-3 flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      <div className="min-w-[92px]">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            if (Number.isNaN(nextValue)) return;
            onChange(clamp(nextValue, min, max));
          }}
          className="h-10 border-border/50 bg-background/80 text-right font-mono text-sm"
        />
        <p className="mt-1 text-right text-[11px] text-muted-foreground">{suffix || "\u00A0"}</p>
      </div>
    </div>

    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(next) => onChange(next[0] ?? value)}
      className="[&_[data-radix-slider-range]]:bg-primary [&_[data-radix-slider-thumb]]:border-primary [&_[data-radix-slider-thumb]]:bg-card"
    />

    <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
      <span>
        {min}
        {suffix}
      </span>
      <span>
        {max}
        {suffix}
      </span>
    </div>
  </div>
);

export default function MotorsPage({ connected, config, state, uartConfigs, pinConfigs, onSendText }: MotorsPageProps) {
  const [settings, setSettings] = useState<MotorSettings>({
    motorType: "brushed",
    motorDriver: "bts7960",
    pwmForwardPin: "6",
    pwmBackwardPin: "7",
    enablePin: "10",
    maxPwm: 100,
    startupPwm: 18,
    pwmFrequency: 20000,
    rampUpMs: 350,
    rampDownMs: 220,
    directionChangeMs: 450,
    directionSmoothing: 65,
  });
  const [liveThrottle, setLiveThrottle] = useState(0);
  const [isDraggingThrottle, setIsDraggingThrottle] = useState(false);
  const liveSendMetaRef = useRef<{ lastSentAt: number; timeoutId: number | null; pendingValue: number | null }>({
    lastSentAt: 0,
    timeoutId: null,
    pendingValue: null,
  });

  const emitAction = useCallback((action: string, payload: Record<string, unknown>) => {
    console.log(`[MotorsPage] ${action}`, payload);
  }, []);

  const updateSetting = useCallback(
    <K extends keyof MotorSettings>(key: K, value: MotorSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        emitAction("motor-config-change", { field: key, value, next });
        return next;
      });
    },
    [emitAction],
  );

  useEffect(() => {
    if (!config) return;
    setSettings({
      motorType: "brushed",
      motorDriver: "bts7960",
      pwmForwardPin: config.rpwmPin >= 0 ? String(config.rpwmPin) : "6",
      pwmBackwardPin: config.lpwmPin >= 0 ? String(config.lpwmPin) : "7",
      enablePin: config.enPin >= 0 ? String(config.enPin) : "10",
      maxPwm: config.maxPwm,
      startupPwm: config.startupPwm,
      pwmFrequency: config.frequency,
      rampUpMs: config.rampUpMs,
      rampDownMs: config.rampDownMs,
      directionChangeMs: config.directionChangeMs,
      directionSmoothing: config.directionSmoothing,
    });
  }, [config]);

  useEffect(() => {
    if (!state) return;
    if (!isDraggingThrottle) {
      setLiveThrottle(state.targetValue);
    }
  }, [state, isDraggingThrottle]);

  const getPinConflictReason = useCallback(
    (pin: number) => {
      const reservation = getPinReservationState({
        pin,
        uartConfigs,
        motorConfig: config,
        draftMotorConfig: {
          rpwmPin: Number(settings.pwmForwardPin),
          lpwmPin: Number(settings.pwmBackwardPin),
          enPin: Number(settings.enablePin),
        },
        ignoreMotorPins: [pin],
      });

      if (reservation.locked) {
        return `GPIO ${pin} jest zablokowany: ${reservation.reason}`;
      }

      const featureUsage = pinConfigs.find((feature) => feature.pin === pin && feature.mode !== "DISABLED");
      if (featureUsage) {
        return `GPIO ${pin} jest już przypisany do funkcji "${getPinModeLabel(featureUsage.mode)}".`;
      }

      return null;
    },
    [config, pinConfigs, settings.enablePin, settings.pwmBackwardPin, settings.pwmForwardPin, uartConfigs],
  );

  const flushLiveDrive = useCallback(
    async (value: number) => {
      liveSendMetaRef.current.lastSentAt = Date.now();
      await Promise.resolve(onSendText(formatMotorCommand("live_drive", { value })));
      emitAction("motor-live-drive-json", { value });
    },
    [emitAction, onSendText],
  );

  const queueLiveDrive = useCallback(
    (value: number, force = false) => {
      if (!connected) return;

      const pending = liveSendMetaRef.current;
      const sendPending = async () => {
        pending.timeoutId = null;
        if (pending.pendingValue === null) return;
        const nextValue = pending.pendingValue;
        pending.pendingValue = null;
        await flushLiveDrive(nextValue);
      };

      if (force) {
        if (pending.timeoutId !== null) {
          window.clearTimeout(pending.timeoutId);
          pending.timeoutId = null;
        }
        pending.pendingValue = null;
        void flushLiveDrive(value);
        return;
      }

      const elapsed = Date.now() - pending.lastSentAt;
      if (elapsed >= 100) {
        void flushLiveDrive(value);
        return;
      }

      pending.pendingValue = value;
      if (pending.timeoutId === null) {
        pending.timeoutId = window.setTimeout(() => {
          void sendPending();
        }, 100 - elapsed);
      }
    },
    [connected, flushLiveDrive],
  );

  const resetThrottle = useCallback(() => {
    setLiveThrottle((prev) => {
      if (prev !== 0) {
        emitAction("motor-live-test", { throttlePercent: 0, reason: "deadman-release" });
      }
      return 0;
    });
    setIsDraggingThrottle(false);
    queueLiveDrive(0, true);
  }, [emitAction, queueLiveDrive]);

  useEffect(() => {
    if (!isDraggingThrottle) return;

    const releaseThrottle = () => resetThrottle();

    window.addEventListener("pointerup", releaseThrottle);
    window.addEventListener("pointercancel", releaseThrottle);
    window.addEventListener("mouseup", releaseThrottle);
    window.addEventListener("touchend", releaseThrottle);

    return () => {
      window.removeEventListener("pointerup", releaseThrottle);
      window.removeEventListener("pointercancel", releaseThrottle);
      window.removeEventListener("mouseup", releaseThrottle);
      window.removeEventListener("touchend", releaseThrottle);
    };
  }, [isDraggingThrottle, resetThrottle]);

  useEffect(() => {
    return () => {
      const pending = liveSendMetaRef.current;
      if (pending.timeoutId !== null) {
        window.clearTimeout(pending.timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (connected) {
        void Promise.resolve(onSendText(formatMotorCommand("emergency_stop")));
      }
    };
  }, [connected, onSendText]);

  const handleThrottleChange = (value: number) => {
    if (!connected) return;
    setLiveThrottle(value);
    emitAction("motor-live-test", { throttlePercent: value, direction: value > 0 ? "forward" : value < 0 ? "reverse" : "stop" });
    queueLiveDrive(value);
  };

  const handleEmergencyStop = async () => {
    setLiveThrottle(0);
    setIsDraggingThrottle(false);
    emitAction("motor-emergency-stop", { throttlePercent: 0 });
    await Promise.resolve(onSendText(formatMotorCommand("emergency_stop")));
  };

  const handleSaveConfig = useCallback(async () => {
    const selectedPins = [
      { pin: Number(settings.pwmForwardPin), label: "PWM Forward" },
      { pin: Number(settings.pwmBackwardPin), label: "PWM Backward" },
      { pin: Number(settings.enablePin), label: "Enable" },
    ];

    if (selectedPins.some(({ pin }) => Number.isNaN(pin))) {
      window.alert("Konfiguracja motoru zawiera nieprawidłowy pin.");
      return;
    }

    const uniquePins = new Set(selectedPins.map(({ pin }) => pin));
    if (uniquePins.size !== selectedPins.length) {
      window.alert("Piny motoru muszą być unikalne. Ten sam GPIO nie może pełnić dwóch ról.");
      return;
    }

    for (const { pin, label } of selectedPins) {
      const conflictReason = getPinConflictReason(pin);
      if (conflictReason) {
        window.alert(`Nie można zapisać motoru.\n${label}: ${conflictReason}`);
        return;
      }
    }

    const payload = {
      rpwm_pin: Number(settings.pwmForwardPin),
      lpwm_pin: Number(settings.pwmBackwardPin),
      en_pin: Number(settings.enablePin),
      freq: settings.pwmFrequency,
      max_pwm: settings.maxPwm,
      startup_pwm: settings.startupPwm,
      ramp_up: settings.rampUpMs,
      ramp_down: settings.rampDownMs,
      direction_change_ms: settings.directionChangeMs,
      direction_smoothing: settings.directionSmoothing,
    };

    const commands = [];
    for (let count = 3; count <= 10; count += 1) {
      commands.push(formatMotorCommand("save_config", payload, count));
    }

    emitAction("motor-save-config-text", { commands });
    for (const command of commands) {
      await Promise.resolve(onSendText(command));
    }
  }, [emitAction, getPinConflictReason, onSendText, settings]);

  const liveDirectionLabel = useMemo(() => {
    if (liveThrottle > 0) return "Forward";
    if (liveThrottle < 0) return "Reverse";
    return "Stopped";
  }, [liveThrottle]);

  const selectedPinWarnings = useMemo(() => {
    const selectedPins = [
      { pin: Number(settings.pwmForwardPin), label: "PWM Forward" },
      { pin: Number(settings.pwmBackwardPin), label: "PWM Backward" },
      { pin: Number(settings.enablePin), label: "Enable" },
    ];

    const warnings: string[] = [];
    const duplicates = selectedPins.filter(
      ({ pin }, index) => !Number.isNaN(pin) && selectedPins.findIndex((entry) => entry.pin === pin) !== index,
    );
    if (duplicates.length > 0) {
      warnings.push("Wybrane piny motoru nie są unikalne.");
    }

    selectedPins.forEach(({ pin, label }) => {
      if (Number.isNaN(pin)) {
        warnings.push(`${label}: nieprawidłowy GPIO.`);
        return;
      }

      const reason = getPinConflictReason(pin);
      if (reason) {
        warnings.push(`${label}: ${reason}`);
      }
    });

    return warnings;
  }, [getPinConflictReason, settings.enablePin, settings.pwmBackwardPin, settings.pwmForwardPin]);

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/40 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.10),_transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary/80">BetaDrive</p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">Motors</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Konfiguracja pojedynczego silnika szczotkowego z mostkiem BTS7960 przez Web Serial API i komendy JSON wysyłane bezpośrednio do ESP32-C3.
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-sm font-medium ${
              connected
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                : "border-border/60 bg-background/70 text-muted-foreground"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-400" : "bg-zinc-500"}`} />
            {connected ? "Serial Connected" : "Disconnected"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="rounded-3xl border-border/50 bg-card/90 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Settings2 className="h-5 w-5 text-primary" />
              Motor Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="motor-type">Motor Type</Label>
                <Select value={settings.motorType} onValueChange={(value: MotorType) => updateSetting("motorType", value)}>
                  <SelectTrigger id="motor-type" className="h-11 border-border/50 bg-background/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brushed">Brushed DC Motor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motor-driver">Motor Driver</Label>
                <Select value={settings.motorDriver} onValueChange={(value: MotorDriver) => updateSetting("motorDriver", value)}>
                  <SelectTrigger id="motor-driver" className="h-11 border-border/50 bg-background/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bts7960">BTS7960</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <ToyBrick className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Number of Motors</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Only 1 motor supported for brushed configuration
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSaveConfig} className="h-11 rounded-2xl px-5 font-semibold">
                <Save className="h-4 w-4" />
                Save Motor Config
              </Button>
              <div className="rounded-2xl border border-border/40 bg-background/60 px-4 py-2 text-xs text-muted-foreground">
                Firmware config: <span className="font-medium text-foreground">{config?.configured ? "ready" : "not configured"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 bg-card/90 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Cable className="h-5 w-5 text-primary" />
              Pin Mapping (ESP32-C3)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pwm-forward">PWM Pin (Forward)</Label>
                <Select value={settings.pwmForwardPin} onValueChange={(value) => updateSetting("pwmForwardPin", value)}>
                  <SelectTrigger id="pwm-forward" className="h-11 border-border/50 bg-background/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gpioOptions.map((pin) => (
                      <SelectItem key={`fwd-${pin}`} value={pin}>
                        GPIO {pin}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Sterowanie RPWM</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pwm-backward">PWM Pin (Backward)</Label>
                <Select value={settings.pwmBackwardPin} onValueChange={(value) => updateSetting("pwmBackwardPin", value)}>
                  <SelectTrigger id="pwm-backward" className="h-11 border-border/50 bg-background/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gpioOptions.map((pin) => (
                      <SelectItem key={`rev-${pin}`} value={pin}>
                        GPIO {pin}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Sterowanie LPWM</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enable-pin">Enable Pin (R_EN / L_EN)</Label>
                <Select value={settings.enablePin} onValueChange={(value) => updateSetting("enablePin", value)}>
                  <SelectTrigger id="enable-pin" className="h-11 border-border/50 bg-background/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gpioOptions.map((pin) => (
                      <SelectItem key={`en-${pin}`} value={pin}>
                        GPIO {pin}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Pin aktywacji sterownika</p>
              </div>
            </div>

            {selectedPinWarnings.length > 0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100/80">
                <p className="font-medium text-amber-200">Konflikt pinów</p>
                <div className="mt-2 space-y-1">
                  {selectedPinWarnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 bg-card/90 shadow-[0_20px_60px_rgba(0,0,0,0.18)] xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Gauge className="h-5 w-5 text-primary" />
              Limits &amp; Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SliderInputRow
              id="max-pwm"
              label="Max Speed / Max PWM"
              hint="Górny limit wysterowania silnika. Przygotowane pod późniejsze mapowanie na sygnał PWM wysyłany do mostka."
              value={settings.maxPwm}
              min={0}
              max={100}
              suffix="%"
              onChange={(value) => updateSetting("maxPwm", value)}
            />

            <SliderInputRow
              id="startup-pwm"
              label="Minimum Startup PWM"
              hint="Minimalny próg ruszenia z miejsca, przydatny gdy silnik nie startuje płynnie przy niskim PWM."
              value={settings.startupPwm}
              min={0}
              max={50}
              suffix="%"
              onChange={(value) => updateSetting("startupPwm", value)}
            />

            <SliderInputRow
              id="pwm-frequency"
              label="PWM Frequency"
              hint="Częstotliwość kluczowania sterownika. Domyślnie ustawiona na 20000 Hz dla cichszej pracy."
              value={settings.pwmFrequency}
              min={1000}
              max={30000}
              step={500}
              suffix=" Hz"
              onChange={(value) => updateSetting("pwmFrequency", value)}
            />

            <div className="grid grid-cols-1 gap-4">
              <SliderInputRow
                id="ramp-up"
                label="Ramp Up Speed"
                hint="Czas narastania mocy podczas przyspieszania, aby ograniczyć szarpnięcia i chronić przekładnie."
                value={settings.rampUpMs}
                min={0}
                max={5000}
                step={50}
                suffix=" ms"
                onChange={(value) => updateSetting("rampUpMs", value)}
              />

              <SliderInputRow
                id="ramp-down"
                label="Ramp Down Speed"
                hint="Czas wygaszania mocy podczas hamowania i zmiany kierunku, pomocny przy delikatniejszej pracy napędu."
                value={settings.rampDownMs}
                min={0}
                max={5000}
                step={50}
                suffix=" ms"
                onChange={(value) => updateSetting("rampDownMs", value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 bg-card/90 shadow-[0_20px_60px_rgba(0,0,0,0.18)] xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Power className="h-5 w-5 text-primary" />
              Direction Change
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid grid-cols-1 gap-4">
              <SliderInputRow
                id="direction-change-time"
                label="Direction Change Time"
                hint="Określa, jak długo napęd ma przechodzić między jazdą do przodu i do tyłu po nagłej zmianie kierunku."
                value={settings.directionChangeMs}
                min={0}
                max={3000}
                step={25}
                suffix=" ms"
                onChange={(value) => updateSetting("directionChangeMs", value)}
              />

              <SliderInputRow
                id="direction-smoothing"
                label="Direction Change Smoothing"
                hint="Ustawia, jak mocno wygładzić przejście przy zmianie kierunku. Wyższa wartość oznacza łagodniejsze, mniej agresywne przełączenie."
                value={settings.directionSmoothing}
                min={0}
                max={100}
                step={1}
                suffix="%"
                onChange={(value) => updateSetting("directionSmoothing", value)}
              />
            </div>

            <div className="flex flex-col gap-4 rounded-3xl border border-border/40 bg-background/50 p-5">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-medium text-foreground">Jak to działa</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Ten blok dotyczy wyłącznie momentu, w którym sterowanie przechodzi z <span className="text-foreground">Forward</span> na <span className="text-foreground">Reverse</span> albo odwrotnie.
                </p>
              </div>

              <div className="rounded-2xl border border-border/40 bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Aktualne ustawienie</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-foreground">{settings.directionChangeMs} ms</p>
                <p className="mt-1 text-sm text-muted-foreground">czas zmiany kierunku</p>
              </div>

              <div className="rounded-2xl border border-border/40 bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Wygładzenie</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-foreground">{settings.directionSmoothing}%</p>
                <p className="mt-1 text-sm text-muted-foreground">intensywność filtrowania zmiany</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 bg-card/90 shadow-[0_20px_60px_rgba(0,0,0,0.18)] xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Zap className="h-5 w-5 text-primary" />
              Live Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_0.9fr]">
              <div className="rounded-3xl border border-border/40 bg-background/50 p-5">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Bi-directional motor test</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Suwak wysyła komendę <span className="font-medium text-foreground">live_drive</span> przez Web Serial mniej więcej co 100 ms. Po puszczeniu natychmiast wraca do zera.
                    </p>
                  </div>
                  <div className="rounded-full border border-border/50 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    Direction: <span className="ml-1 text-foreground">{liveDirectionLabel}</span>
                  </div>
                </div>

                <div className={`rounded-3xl border px-4 py-5 transition-all ${connected ? "border-primary/20 bg-primary/5" : "border-border/40 bg-background/60 opacity-75"}`}>
                  <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <span>Reverse</span>
                    <span>Stop</span>
                    <span>Forward</span>
                  </div>

                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={liveThrottle}
                    disabled={!connected}
                    aria-label="Motor live test throttle"
                    onPointerDown={() => setIsDraggingThrottle(true)}
                    onMouseDown={() => setIsDraggingThrottle(true)}
                    onTouchStart={() => setIsDraggingThrottle(true)}
                    onChange={(event) => handleThrottleChange(Number(event.target.value))}
                    onKeyUp={resetThrottle}
                    onBlur={resetThrottle}
                    className="h-3 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-primary disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Output</p>
                      <p className="mt-1 font-mono text-3xl font-semibold text-foreground">
                        {liveThrottle > 0 ? "+" : ""}
                        {liveThrottle}%
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Firmware Target</p>
                      <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
                        {state ? `${state.targetValue > 0 ? "+" : ""}${state.targetValue}%` : "—"}
                      </p>
                    </div>

                    <div className="text-left text-xs text-muted-foreground md:text-right">
                      <p>Firmware Output: <span className="font-medium text-foreground">{state ? `${state.outputValue > 0 ? "+" : ""}${state.outputValue}%` : "—"}</span></p>
                      <p>Deadman Switch: active</p>
                      <p>Failsafe: <span className={state?.failsafe ? "font-medium text-destructive" : "font-medium text-foreground"}>{state?.failsafe ? "TRIGGERED" : "idle"}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-3xl border border-border/40 bg-background/50 p-5">
                <div className="rounded-2xl border border-border/40 bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Power className="h-4 w-4 text-primary" />
                    Test state
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Połączenie jest współdzielone z całym konfiguratoreм. Ta sekcja korzysta z tego samego portu Web Serial co reszta aplikacji.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-200">
                    <ShieldAlert className="h-4 w-4" />
                    Safety
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-amber-100/80">
                    Emergency stop zeruje testowe sterowanie natychmiast i loguje osobną akcję gotową do podpięcia pod ESP32-C3.
                  </p>
                </div>

                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleEmergencyStop}
                  className="mt-auto h-14 rounded-2xl text-base font-semibold shadow-[0_16px_40px_rgba(220,38,38,0.25)]"
                >
                  EMERGENCY STOP
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
