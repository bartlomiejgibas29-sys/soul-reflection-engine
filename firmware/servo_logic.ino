#include "config.h"

// ============================================================
// servo_logic.ino — Betaflight-style servo mixer for ESP32-C3
// ============================================================
// Each servo maps an RC source channel (1-16) to a PWM output
// using min/mid/max microsecond values, with rate (deflection
// multiplier) and optional reverse.
//
// When sourceChannel == 0, servo holds its last commanded
// position (set via SERVO_MOVE serial command).
// ============================================================

int findServoIdx(int pin) {
    for (int i = 0; i < servoCount; i++) {
        if (servoConfigs[i].pin == pin) return i;
    }
    return -1;
}

// Convert microseconds to LEDC duty (12-bit resolution for stability)
static void writeServoUs(int pin, int frequency, float us) {
    uint32_t periodUs = 1000000UL / frequency;
    uint32_t duty = (uint32_t)((us * 4095ULL) / periodUs);
    ledcWrite(pin, duty);
}

void handleServoLoop() {
    extern uint8_t pinModeArr[22];

    for (int p = 0; p < 22; p++) {
        if (pinModeArr[p] != 2) continue; // Not a servo pin

        int idx = findServoIdx(p);
        if (idx == -1) continue;

        ServoConfig &c = servoConfigs[idx];

        // --- Determine target microseconds ---
        float targetUs = c.currentUs;

        if (receiverMode && c.sourceChannel >= 1 && c.sourceChannel <= 16) {
            // Read RC channel only when receiver mode is active and data is fresh
            int rcVal = crsf.getChannel(c.sourceChannel);
            bool freshData = (millis() - lastCrsfUpdate) < 500;
            bool validRange = rcVal >= 800 && rcVal <= 2200;

            if (freshData && validRange) {
                if (c.mode == 1) { // RANGES MODE
                     // Iterate through ranges
                     for (int r = 0; r < c.rangeCount; r++) {
                         if (rcVal >= c.ranges[r].minIn && rcVal <= c.ranges[r].maxIn) {
                             targetUs = (float)c.ranges[r].targetUs;
                             break; // First match wins
                         }
                     }
                } else { // PROPORTIONAL MODE (Default)
                    // Map RC value to servo output using min/mid/max + rate
                    float deflection = (float)(rcVal - 1500);

                    // Apply rate (deflection multiplier, e.g. 1.0 = 100%)
                    deflection *= c.rate;

                    // Apply reverse
                    if (c.reverse) deflection = -deflection;

                    // Target = mid + scaled deflection, clamped to min..max
                    targetUs = (float)c.midUs + deflection;
                }
                
                // Final clamp to min/max
                if (targetUs < (float)c.minUs) targetUs = (float)c.minUs;
                if (targetUs > (float)c.maxUs) targetUs = (float)c.maxUs;
            }
        }

        // --- Speed limiting (optional smoothing) ---
        if (c.speed > 0) {
            // speed is in us/second
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

        // --- Write PWM only if position changed ---
        int roundedUs = (int)(c.currentUs + 0.5f);
        if (roundedUs != c.lastWrittenUs) {
            writeServoUs(p, c.frequency, c.currentUs);
            c.lastWrittenUs = roundedUs;
        }
    }
}
