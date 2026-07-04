export type MotorCommandAction = "live_drive" | "emergency_stop" | "save_config" | "motor_pins";

export function formatMotorCommand(action: MotorCommandAction, payload?: Record<string, unknown>, fieldCount?: number) {
  switch (action) {
    case "live_drive": {
      const value = typeof payload?.value === "number" ? payload.value : 0;
      return `SET_MOTOR_LIVE:${value}`;
    }
    case "emergency_stop":
      return "SET_MOTOR_EMERGENCY_STOP";
    case "motor_pins":
      return "MOTOR_PINS";
    case "save_config": {
      const fields = [
        payload?.rpwm_pin ?? -1,
        payload?.lpwm_pin ?? -1,
        payload?.en_pin ?? -1,
        payload?.freq ?? 20000,
        payload?.max_pwm ?? 100,
        payload?.startup_pwm ?? 0,
        payload?.ramp_up ?? payload?.ramp ?? 200,
        payload?.ramp_down ?? 200,
        payload?.direction_change_ms ?? 250,
        payload?.direction_smoothing ?? 50,
      ];
      const sliceCount = Math.min(fields.length, fieldCount ?? fields.length);
      return `SET_MOTOR_CONFIG:${fields.slice(0, sliceCount).join(":")}`;
    }
    default:
      return "";
  }
}
