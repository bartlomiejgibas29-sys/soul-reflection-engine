import { describe, expect, it } from "vitest";
import { formatMotorCommand } from "../lib/motorCommands";

describe("formatMotorCommand", () => {
  it("formats a live drive command", () => {
    expect(formatMotorCommand("live_drive", { value: 42 })).toBe("SET_MOTOR_LIVE:42");
  });

  it("formats an emergency stop command", () => {
    expect(formatMotorCommand("emergency_stop")).toBe("SET_MOTOR_EMERGENCY_STOP");
  });

  it("formats a motor pins request command", () => {
    expect(formatMotorCommand("motor_pins")).toBe("MOTOR_PINS");
  });

  it("formats a save config command", () => {
    expect(
      formatMotorCommand("save_config", {
        rpwm_pin: 6,
        lpwm_pin: 7,
        en_pin: 10,
        freq: 20000,
        max_pwm: 100,
        startup_pwm: 18,
        ramp_up: 350,
        ramp_down: 220,
        direction_change_ms: 450,
        direction_smoothing: 65,
      }),
    ).toBe("SET_MOTOR_CONFIG:6:7:10:20000:100:18:350:220:450:65");
  });
});
