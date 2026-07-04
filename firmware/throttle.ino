#include "config.h"

static int throttlePin = -1;
static unsigned long throttleLastValidDataMs = 0;
static bool throttleFailsafeActive = false;

// Convert microseconds to LEDC duty
static void writeThrottleUs(int pin, int frequency, float us) {
    uint32_t periodUs = 1000000UL / frequency;
    uint32_t duty = (uint32_t)((us * 4095ULL) / periodUs);
    ledcWrite(pin, duty);
}

void initThrottle() {
    Serial.println(">> Throttle initialized");
    throttleLastValidDataMs = 0;
    throttleFailsafeActive = false;
}

void handleThrottle() {
    if (!receiverMode) return;

    // Check if we have fresh receiver data
    bool freshData = (millis() - lastCrsfUpdate) < 500;
    bool anyThrottleControlled = false;

    // Find servo configured for throttle (use sourceChannel == throttle_ch or speed_ch)
    extern uint8_t pinModeArr[22];
    for (int p = 0; p < 22; p++) {
        if (pinModeArr[p] != 2) continue; // Only check servo pins

        int idx = findServoIdx(p);
        if (idx == -1) continue;
        ServoConfig &c = servoConfigs[idx];

        bool isThrottleServo = (c.sourceChannel == throttle_ch || c.sourceChannel == speed_ch);
        if (!isThrottleServo) continue;

        if (freshData) {
            float targetUs = c.currentUs;
            bool shouldControl = false;

            if (control_mode == "PROPORTIONAL") {
                if (c.sourceChannel == throttle_ch) {
                    shouldControl = true;
                    int rcVal = crsf.getChannel(throttle_ch);
                    bool validRange = rcVal >= 800 && rcVal <= 2200;
                    if (validRange) {
                        float deflection = (float)(rcVal - rc_mid);
                        if (throttle_rev) deflection = -deflection;
                        targetUs = (float)c.midUs + deflection;
                        anyThrottleControlled = true;
                    }
                }
            } else if (control_mode == "DIRECTION_SELECTED") {
                if (c.sourceChannel == speed_ch) {
                    shouldControl = true;
                    int speedVal = crsf.getChannel(speed_ch);
                    int dirVal = crsf.getChannel(direction_ch);
                    bool validSpeedRange = speedVal >= 800 && speedVal <= 2200;
                    bool validDirRange = dirVal >= 800 && dirVal <= 2200;
                    if (validSpeedRange && validDirRange) {
                        bool dirPressed = dirVal > rc_mid;
                        if (dir_pressed_is_reverse) dirPressed = !dirPressed;
                        float speedFromMid = (float)(speedVal - rc_mid);
                        float speedDeflection = dirPressed ? -speedFromMid : speedFromMid;
                        targetUs = (float)c.midUs + speedDeflection;
                        anyThrottleControlled = true;
                    }
                }
            }

            if (shouldControl && anyThrottleControlled) {
                if (throttleFailsafeActive) {
                    throttleFailsafeActive = false;
                    Serial.println(">> Throttle failsafe released");
                }

                if (targetUs < (float)c.minUs) targetUs = (float)c.minUs;
                if (targetUs > (float)c.maxUs) targetUs = (float)c.maxUs;

                if (c.speed > 0) {
                    static unsigned long lastTime[MAX_SERVOS] = {0};
                    unsigned long now = millis();
                    float dt = (now - lastTime[idx]) / 1000.0f;
                    if (dt <= 0) dt = 0.001f;
                    lastTime[idx] = now;
                    float maxStep = c.speed * dt;
                    float diff = targetUs - c.currentUs;
                    if (diff > maxStep) c.currentUs += maxStep;
                    else if (diff < -maxStep) c.currentUs -= maxStep;
                    else c.currentUs = targetUs;
                } else {
                    c.currentUs = targetUs;
                }

                int roundedUs = (int)(c.currentUs + 0.5f);
                if (roundedUs != c.lastWrittenUs) {
                    writeThrottleUs(p, c.frequency, c.currentUs);
                    c.lastWrittenUs = roundedUs;
                }
            }
        }
    }

    if (anyThrottleControlled) {
        throttleLastValidDataMs = millis();
    } else if (!throttleFailsafeActive && (millis() - throttleLastValidDataMs) > 500) {
        throttleFailsafeActive = true;
        Serial.println(">> Throttle failsafe triggered: return to neutral");
        // Reset all servo throttles to neutral
        for (int p = 0; p < 22; p++) {
            if (pinModeArr[p] != 2) continue;
            int idx = findServoIdx(p);
            if (idx == -1) continue;
            ServoConfig &c = servoConfigs[idx];
            bool isThrottleServo = (c.sourceChannel == throttle_ch || c.sourceChannel == speed_ch);
            if (isThrottleServo) {
                c.currentUs = (float)c.midUs;
                int roundedUs = (int)(c.currentUs + 0.5f);
                if (roundedUs != c.lastWrittenUs) {
                    writeThrottleUs(p, c.frequency, c.currentUs);
                    c.lastWrittenUs = roundedUs;
                }
            }
        }
    }
}
