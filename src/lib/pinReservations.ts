export interface PinReservationState {
  locked: boolean;
  reason: string;
  source: "usb" | "uart" | "motor" | null;
}

export interface PinReservationInput {
  pin: number;
  uartConfigs?: Array<{ enabled?: boolean; rx?: number; tx?: number; id?: number; type?: string }>;
  pinConfigs?: Array<{ pin: number; mode?: string }>;
  motorConfig?: { rpwmPin?: number; lpwmPin?: number; enPin?: number } | null;
  draftMotorConfig?: { rpwmPin?: number; lpwmPin?: number; enPin?: number } | null;
  reservedUsbPins?: number[];
  ignoreMotorPins?: number[];
}

export function getPinReservationState({
  pin,
  uartConfigs = [],
  pinConfigs = [],
  motorConfig = null,
  draftMotorConfig = null,
  reservedUsbPins = [20, 21],
  ignoreMotorPins = [],
}: PinReservationInput): PinReservationState {
  if (reservedUsbPins.includes(pin)) {
    return {
      locked: true,
      reason: "Blocked in Pins tab because it is reserved for USB/programming (GPIO 20/21)",
      source: "usb",
    };
  }

  const uartUsage = uartConfigs.find((uart) => uart.enabled && (uart.rx === pin || uart.tx === pin));
  if (uartUsage) {
    return {
      locked: true,
      reason: `Blocked in Pins tab because UART ${uartUsage.id} (${uartUsage.type || "GENERIC"}) uses it`,
      source: "uart",
    };
  }

  const tableMotorPin = pinConfigs?.find((cfg) => cfg.pin === pin && cfg.mode === "MOTOR");
  if (tableMotorPin) {
    return {
      locked: true,
      reason: "Blocked in Pins tab because the motor driver pin appears in PIN_TABLE",
      source: "motor",
    };
  }

  const motorSource = draftMotorConfig ?? motorConfig;
  const ignoreMotorPinsSet = new Set(ignoreMotorPins ?? []);

  if (motorSource) {
    if (motorSource.rpwmPin === pin && !ignoreMotorPinsSet.has(pin)) {
      return {
        locked: true,
        reason: "Blocked in Pins tab because the motor driver uses it for PWM Forward",
        source: "motor",
      };
    }

    if (motorSource.lpwmPin === pin && !ignoreMotorPinsSet.has(pin)) {
      return {
        locked: true,
        reason: "Blocked in Pins tab because the motor driver uses it for PWM Backward",
        source: "motor",
      };
    }

    if (motorSource.enPin === pin && !ignoreMotorPinsSet.has(pin)) {
      return {
        locked: true,
        reason: "Blocked in Pins tab because the motor driver uses it for Enable",
        source: "motor",
      };
    }
  }

  return {
    locked: false,
    reason: "",
    source: null,
  };
}
