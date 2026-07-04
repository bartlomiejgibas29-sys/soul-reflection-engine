#include "config.h"

static unsigned long motorLastLoopMs = 0;
static unsigned long motorLastLiveCommandMs = 0;
static unsigned long motorLastTelemetryMs = 0;
static unsigned long motorZeroHoldStartedMs = 0;
static bool motorReverseTransition = false;
static int motorPendingReverseTargetPercent = 0;

static bool isMotorUserPin(int pin) {
    if (pin == -1) return true;
    if (pin == 20 || pin == 21) return false;
    if (pin >= 0 && pin <= 10) return true;
    if (pin >= 18 && pin <= 19) return true;
    return false;
}

static bool pinReservedByUart(int pin) {
    if (pin < 0) return false;
    if (u1_enabled && (pin == u1_rx || pin == u1_tx)) return true;
    if (u2_enabled && (pin == u2_rx || pin == u2_tx)) return true;
    if (u3_enabled && (pin == u3_rx || pin == u3_tx)) return true;
    return false;
}

static bool pinReservedByOtherFeature(int pin) {
    if (pin < 0 || pin >= 22) return false;
    return pinModeArr[pin] != 0;
}

bool isAnyMotorPinSelected(int pin) {
    if (pin < 0) return false;
    return pin == motor_rpwm_pin || pin == motor_lpwm_pin || pin == motor_en_pin;
}

bool isMotorPinReserved(int pin) {
    return isAnyMotorPinSelected(pin);
}

const char* getMotorPinRole(int pin) {
    if (pin == motor_rpwm_pin) return "MOTOR_RPWM";
    if (pin == motor_lpwm_pin) return "MOTOR_LPWM";
    if (pin == motor_en_pin) return "MOTOR_EN";
    return "";
}

static bool sameSign(float a, float b) {
    return (a > 0.0f && b > 0.0f) || (a < 0.0f && b < 0.0f);
}

static float absfLocal(float value) {
    return value >= 0.0f ? value : -value;
}

static int clampPercent(int value, int minVal, int maxVal) {
    if (value < minVal) return minVal;
    if (value > maxVal) return maxVal;
    return value;
}

static int clampPositive(int value, int maxVal) {
    if (value < 0) return 0;
    if (value > maxVal) return maxVal;
    return value;
}

static uint32_t percentToDuty(int percent) {
    percent = clampPercent(percent, 0, 100);
    return (uint32_t)((percent * 4095UL) / 100UL);
}

static void setMotorPwmLow() {
    if (motor_rpwm_pin >= 0) {
        ledcWrite(motor_rpwm_pin, 0);
        pinMode(motor_rpwm_pin, OUTPUT);
        digitalWrite(motor_rpwm_pin, LOW);
    }
    if (motor_lpwm_pin >= 0) {
        ledcWrite(motor_lpwm_pin, 0);
        pinMode(motor_lpwm_pin, OUTPUT);
        digitalWrite(motor_lpwm_pin, LOW);
    }
}

static void applyEnablePin(bool active) {
    if (motor_en_pin >= 0) {
        pinMode(motor_en_pin, OUTPUT);
        digitalWrite(motor_en_pin, active ? HIGH : LOW);
    }
}

static void motorDriverOutputsLow() {
    setMotorPwmLow();
    applyEnablePin(false);
}

static bool validateMotorPins(int rpwmPin, int lpwmPin, int enPin, bool verbose) {
    if (!isMotorUserPin(rpwmPin) || !isMotorUserPin(lpwmPin) || !isMotorUserPin(enPin)) {
        if (verbose) Serial.println("MOTOR_ERR,invalid_pin");
        return false;
    }
    if (rpwmPin < 0 || lpwmPin < 0) {
        if (verbose) Serial.println("MOTOR_ERR,missing_pwm_pin");
        return false;
    }
    if (rpwmPin == lpwmPin || rpwmPin == enPin || lpwmPin == enPin) {
        if (verbose) Serial.println("MOTOR_ERR,pins_must_be_unique");
        return false;
    }
    if (pinReservedByUart(rpwmPin) || pinReservedByUart(lpwmPin) || pinReservedByUart(enPin)) {
        if (verbose) Serial.println("MOTOR_ERR,pin_used_by_uart");
        return false;
    }
    if (pinReservedByOtherFeature(rpwmPin) || pinReservedByOtherFeature(lpwmPin) || pinReservedByOtherFeature(enPin)) {
        if (verbose) Serial.println("MOTOR_ERR,pin_reserved_by_feature");
        return false;
    }
    return true;
}

static void applyMotorOutput(float signedPercent) {
    if (!motor_configured) {
        motorDriverOutputsLow();
        return;
    }

    signedPercent = (float)clampPercent((int)(signedPercent + (signedPercent >= 0.0f ? 0.5f : -0.5f)), -100, 100);
    int limitedPercent = (int)((signedPercent * motor_max_pwm_percent) / 100.0f);
    int magnitude = limitedPercent >= 0 ? limitedPercent : -limitedPercent;

    if (magnitude > 0 && magnitude < motor_startup_pwm_percent) {
        magnitude = motor_startup_pwm_percent;
    }

    if (magnitude <= 0) {
        setMotorPwmLow();
        applyEnablePin(motor_live_test_active);
        return;
    }

    applyEnablePin(true);
    uint32_t duty = percentToDuty(magnitude);
    if (limitedPercent > 0) {
        ledcWrite(motor_lpwm_pin, 0);
        ledcWrite(motor_rpwm_pin, duty);
    } else {
        ledcWrite(motor_rpwm_pin, 0);
        ledcWrite(motor_lpwm_pin, duty);
    }
}

static float approachPercent(float currentValue, float targetValue, unsigned long dtMs, int rampMs) {
    if (rampMs <= 0 || dtMs == 0) return targetValue;

    float changePerMs = 100.0f / (float)rampMs;
    float maxStep = changePerMs * (float)dtMs;
    float diff = targetValue - currentValue;

    if (diff > maxStep) return currentValue + maxStep;
    if (diff < -maxStep) return currentValue - maxStep;
    return targetValue;
}

static int chooseRampForTarget(float currentValue, float targetValue) {
    if (absfLocal(targetValue) > absfLocal(currentValue)) {
        return motor_ramp_up_ms;
    }
    return motor_ramp_down_ms;
}

static void detachMotorPins() {
    if (motor_rpwm_pin >= 0) ledcDetach(motor_rpwm_pin);
    if (motor_lpwm_pin >= 0) ledcDetach(motor_lpwm_pin);
    motorDriverOutputsLow();
}

void reportMotorConfig() {
    Serial.printf("MOTOR_CFG,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d\n",
        motor_rpwm_pin,
        motor_lpwm_pin,
        motor_en_pin,
        motor_pwm_freq,
        motor_max_pwm_percent,
        motor_startup_pwm_percent,
        motor_ramp_up_ms,
        motor_ramp_down_ms,
        motor_direction_change_ms,
        motor_direction_smoothing,
        motor_configured ? 1 : 0);
}

void reportMotorPins() {
    Serial.printf("MOTOR_PINS,%d,%d,%d\n",
        motor_rpwm_pin,
        motor_lpwm_pin,
        motor_en_pin);
}

void reportMotorState() {
    Serial.printf("MOTOR_STATE,%d,%d,%d,%d\n",
        motor_live_test_active ? 1 : 0,
        motor_live_target_percent,
        (int)(motor_current_output_percent + (motor_current_output_percent >= 0.0f ? 0.5f : -0.5f)),
        motor_failsafe_triggered ? 1 : 0);
}

void emergencyStopMotor(bool reportState) {
    motor_live_test_active = false;
    motor_live_target_percent = 0;
    motor_current_output_percent = 0.0f;
    motorReverseTransition = false;
    motorPendingReverseTargetPercent = 0;
    motorZeroHoldStartedMs = 0;
    motorDriverOutputsLow();
    if (reportState) {
        reportMotorState();
    }
}

void initMotorDriver() {
    detachMotorPins();

    if (!validateMotorPins(motor_rpwm_pin, motor_lpwm_pin, motor_en_pin, false)) {
        motor_configured = false;
        motorDriverOutputsLow();
        return;
    }

    motor_pwm_freq = clampPositive(motor_pwm_freq, 40000);
    if (motor_pwm_freq < 100) motor_pwm_freq = 20000;

    if (!ledcAttach(motor_rpwm_pin, motor_pwm_freq, 12)) {
        Serial.println("MOTOR_ERR,rpwm_attach_failed");
        motor_configured = false;
        return;
    }
    if (!ledcAttach(motor_lpwm_pin, motor_pwm_freq, 12)) {
        Serial.println("MOTOR_ERR,lpwm_attach_failed");
        ledcDetach(motor_rpwm_pin);
        motor_configured = false;
        return;
    }

    pinMode(motor_rpwm_pin, OUTPUT);
    pinMode(motor_lpwm_pin, OUTPUT);
    if (motor_en_pin >= 0) {
        pinMode(motor_en_pin, OUTPUT);
        digitalWrite(motor_en_pin, LOW);
    }

    motor_current_output_percent = 0.0f;
    motor_live_target_percent = 0;
    motorReverseTransition = false;
    motorPendingReverseTargetPercent = 0;
    motorZeroHoldStartedMs = 0;
    motorLastLoopMs = millis();
    motor_configured = true;
    motorDriverOutputsLow();
}

static void saveMotorPreferences() {
    prefs.begin("sys_config", false);
    prefs.putInt("mot_rpwm", motor_rpwm_pin);
    prefs.putInt("mot_lpwm", motor_lpwm_pin);
    prefs.putInt("mot_en", motor_en_pin);
    prefs.putInt("mot_freq", motor_pwm_freq);
    prefs.putInt("mot_max", motor_max_pwm_percent);
    prefs.putInt("mot_start", motor_startup_pwm_percent);
    prefs.putInt("mot_rup", motor_ramp_up_ms);
    prefs.putInt("mot_rdn", motor_ramp_down_ms);
    prefs.putInt("mot_dirchg", motor_direction_change_ms);
    prefs.putInt("mot_dirs", motor_direction_smoothing);
    prefs.end();
}

static bool applySavedMotorConfig(int rpwmPin, int lpwmPin, int enPin, int freq, int maxPwm, int startupPwm, int rampUp, int rampDown, int directionChange, int directionSmoothing) {
    if (!validateMotorPins(rpwmPin, lpwmPin, enPin, true)) {
        return false;
    }

    motor_rpwm_pin = rpwmPin;
    motor_lpwm_pin = lpwmPin;
    motor_en_pin = enPin;
    motor_pwm_freq = freq < 100 ? 20000 : freq;
    motor_max_pwm_percent = clampPercent(maxPwm, 0, 100);
    motor_startup_pwm_percent = clampPercent(startupPwm, 0, 50);
    motor_ramp_up_ms = clampPositive(rampUp, 10000);
    motor_ramp_down_ms = clampPositive(rampDown, 10000);
    motor_direction_change_ms = clampPositive(directionChange, 5000);
    motor_direction_smoothing = clampPercent(directionSmoothing, 0, 100);

    saveMotorPreferences();
    initMotorDriver();
    emergencyStopMotor(false);
    return motor_configured;
}

bool processTextMotorCommand(const String& cmd) {
    if (!cmd.startsWith("MOTOR_") && !cmd.startsWith("SET_MOTOR_")) return false;

    if (cmd == "MOTOR_CONFIG") {
        reportMotorConfig();
        return true;
    }

    if (cmd == "MOTOR_STATE") {
        reportMotorState();
        return true;
    }

    if (cmd == "MOTOR_PINS") {
        reportMotorPins();
        return true;
    }

    if (cmd == "SET_MOTOR_EMERGENCY_STOP" || cmd == "MOTOR_EMERGENCY_STOP") {
        motor_failsafe_triggered = false;
        emergencyStopMotor(false);
        Serial.println("MOTOR_ACK,emergency_stop,ok");
        reportMotorState();
        return true;
    }

    if (cmd.startsWith("SET_MOTOR_LIVE_TEST:")) {
        int value = cmd.substring(20).toInt();
        if (value == 1) {
            if (!motor_configured) {
                Serial.println("MOTOR_ERR,not_configured");
                return true;
            }
            motor_failsafe_triggered = false;
            motor_live_test_active = true;
            motor_live_target_percent = 0;
            motor_current_output_percent = 0.0f;
            motorReverseTransition = false;
            motorPendingReverseTargetPercent = 0;
            motorZeroHoldStartedMs = 0;
            motorLastLiveCommandMs = millis();
            applyMotorOutput(0.0f);
            Serial.println("MOTOR_ACK,live_test,on");
            reportMotorState();
        } else {
            motor_failsafe_triggered = false;
            emergencyStopMotor(false);
            Serial.println("MOTOR_ACK,live_test,off");
            reportMotorState();
        }
        return true;
    }

    if (cmd.startsWith("SET_MOTOR_LIVE:") || cmd.startsWith("MOTOR_LIVE:")) {
        int prefixLength = cmd.startsWith("SET_MOTOR_LIVE:") ? 15 : 11;
        int value = cmd.substring(prefixLength).toInt();
        if (!motor_configured) {
            Serial.println("MOTOR_ERR,not_configured");
            return true;
        }
        if (!motor_live_test_active) {
            Serial.println("MOTOR_ERR,live_test_disabled");
            return true;
        }

        motor_live_target_percent = clampPercent(value, -100, 100);
        motor_failsafe_triggered = false;
        motorLastLiveCommandMs = millis();
        reportMotorState();
        return true;
    }

    if (cmd.startsWith("SET_MOTOR_CONFIG:") || cmd.startsWith("MOTOR_SAVE:")) {
        int prefixLength = cmd.startsWith("SET_MOTOR_CONFIG:") ? 17 : 11;
        String payload = cmd.substring(prefixLength);
        int rpwmPin = motor_rpwm_pin;
        int lpwmPin = motor_lpwm_pin;
        int enPin = motor_en_pin;
        int freq = motor_pwm_freq;
        int maxPwm = motor_max_pwm_percent;
        int startupPwm = motor_startup_pwm_percent;
        int rampUp = motor_ramp_up_ms;
        int rampDown = motor_ramp_down_ms;
        int directionChange = motor_direction_change_ms;
        int directionSmoothing = motor_direction_smoothing;

        int parts[10] = {0};
        int index = 0;
        int start = 0;
        while (index < 10 && start <= payload.length()) {
            int next = payload.indexOf(':', start);
            if (next == -1) {
                parts[index++] = payload.substring(start).toInt();
                break;
            }
            parts[index++] = payload.substring(start, next).toInt();
            start = next + 1;
        }

        if (index >= 3) {
            rpwmPin = parts[0];
            lpwmPin = parts[1];
            enPin = parts[2];
        }
        if (index >= 4) freq = parts[3];
        if (index >= 5) maxPwm = parts[4];
        if (index >= 6) startupPwm = parts[5];
        if (index >= 7) rampUp = parts[6];
        if (index >= 8) rampDown = parts[7];
        if (index >= 9) directionChange = parts[8];
        if (index >= 10) directionSmoothing = parts[9];

        if (applySavedMotorConfig(rpwmPin, lpwmPin, enPin, freq, maxPwm, startupPwm, rampUp, rampDown, directionChange, directionSmoothing)) {
            Serial.println("MOTOR_ACK,save_config,ok");
        } else {
            Serial.println("MOTOR_ACK,save_config,error");
        }
        reportMotorConfig();
        reportMotorState();
        return true;
    }

    Serial.println("MOTOR_ERR,unknown_command");
    return true;
}

void handleMotorLoop() {
    unsigned long now = millis();
    if (motorLastLoopMs == 0) motorLastLoopMs = now;
    unsigned long dtMs = now - motorLastLoopMs;
    motorLastLoopMs = now;

    if (!motor_configured) return;

    if (motorTelemetry && motor_live_test_active && (now - motorLastTelemetryMs > 100UL)) {
        motorLastTelemetryMs = now;
        reportMotorState();
    }

    if (motor_live_test_active && (now - motorLastLiveCommandMs > 400UL)) {
        motor_failsafe_triggered = true;
        emergencyStopMotor(false);
        Serial.println("MOTOR_FAILSAFE,1");
        reportMotorState();
        return;
    }

    int desiredTarget = motor_live_test_active ? clampPercent(motor_live_target_percent, -100, 100) : 0;
    float currentValue = motor_current_output_percent;

    if (motorReverseTransition) {
        motorPendingReverseTargetPercent = desiredTarget;
        if (desiredTarget == 0) {
            motorReverseTransition = false;
            motorZeroHoldStartedMs = 0;
        }
    }

    if (!motorReverseTransition && desiredTarget != 0 && currentValue != 0.0f && !sameSign(currentValue, (float)desiredTarget)) {
        motorReverseTransition = true;
        motorPendingReverseTargetPercent = desiredTarget;
        motorZeroHoldStartedMs = 0;
    }

    int targetForStep = desiredTarget;
    int rampToUse = chooseRampForTarget(currentValue, (float)desiredTarget);

    if (motorReverseTransition) {
        targetForStep = 0;
        float smoothingScale = 1.0f + ((float)motor_direction_smoothing / 100.0f);
        rampToUse = (int)((float)motor_ramp_down_ms * smoothingScale);
    }

    float nextValue = approachPercent(currentValue, (float)targetForStep, dtMs, rampToUse);
    if (absfLocal(nextValue) < 0.25f) nextValue = 0.0f;
    motor_current_output_percent = nextValue;

    if (motorReverseTransition && motor_current_output_percent == 0.0f) {
        if (motorZeroHoldStartedMs == 0) {
            motorZeroHoldStartedMs = now;
        }

        unsigned long holdMs = (unsigned long)((float)motor_direction_change_ms * (0.25f + (0.75f * (float)motor_direction_smoothing / 100.0f)));
        if ((now - motorZeroHoldStartedMs) >= holdMs) {
            motorReverseTransition = false;
            motorZeroHoldStartedMs = 0;
            desiredTarget = motorPendingReverseTargetPercent;
        }
    }

    if (!motorReverseTransition && desiredTarget != 0) {
        int activeRamp = chooseRampForTarget(motor_current_output_percent, (float)desiredTarget);
        float rampedValue = approachPercent(motor_current_output_percent, (float)desiredTarget, dtMs, activeRamp);
        if (absfLocal(rampedValue) < 0.25f) rampedValue = 0.0f;
        motor_current_output_percent = rampedValue;
    }

    applyMotorOutput(motor_current_output_percent);
}
