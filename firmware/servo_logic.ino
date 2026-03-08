#include "config.h"

// Helper to find servo index by pin
int findServoIdx(int pin) {
    for (int i = 0; i < servoCount; i++) {
        if (servoConfigs[i].pin == pin) return i;
    }
    return -1;
}

void handleServoLoop() {
    static unsigned long lastUpdate = 0;
    unsigned long now = millis();
    float dt = (now - lastUpdate) / 1000.0f;
    if (dt <= 0) dt = 0.001f;
    lastUpdate = now;

    // External array for current pin modes (declared in serial_comm.ino)
    extern uint8_t pinModeArr[22];

    for (int p = 0; p < 22; p++) {
        if (pinModeArr[p] != 2) continue; // Not a servo
        
        int idx = findServoIdx(p);
        if (idx == -1) continue;
        
        ServoConfig &c = servoConfigs[idx];

        float targetAngle = c.currentPos; // Default to current if no source

        if (c.sourceChannel >= 1 && c.sourceChannel <= 16) {
            int rcVal = crsf.getChannel(c.sourceChannel); // 988 - 2012
            
            if (c.numPoints > 0) {
                // Find boundaries
                if (rcVal <= c.points[0].inValue) {
                    targetAngle = (float)c.points[0].outAngle;
                } else if (rcVal >= c.points[c.numPoints - 1].inValue) {
                    targetAngle = (float)c.points[c.numPoints - 1].outAngle;
                } else {
                    // Find the segment where rcVal lies
                    for (int i = 0; i < c.numPoints - 1; i++) {
                        if (rcVal >= c.points[i].inValue && rcVal <= c.points[i+1].inValue) {
                            if (c.points[i+1].proportional) {
                                // Linear interpolation between points[i] and points[i+1]
                                float t = (float)(rcVal - c.points[i].inValue) / (float)(c.points[i+1].inValue - c.points[i].inValue);
                                targetAngle = (float)c.points[i].outAngle + t * (float)(c.points[i+1].outAngle - c.points[i].outAngle);
                            } else {
                                // Fixed (closest point jump logic or just stay at current segment end)
                                // Standard RC logic for "fixed": if past 50% of segment, jump to next point
                                int mid = (c.points[i].inValue + c.points[i+1].inValue) / 2;
                                targetAngle = (rcVal < mid) ? (float)c.points[i].outAngle : (float)c.points[i+1].outAngle;
                            }
                            break;
                        }
                    }
                }
            }
        }

        // 2. Handle Speed (Smoothing)
        if (c.speed > 0) {
            float step = c.speed * dt;
            if (targetAngle > c.currentPos + step) c.currentPos += step;
            else if (targetAngle < c.currentPos - step) c.currentPos -= step;
            else c.currentPos = targetAngle;
        } else {
            c.currentPos = targetAngle;
        }

        // 3. Convert Angle to Pulse Width (us)
        // Assume 0-180 deg range maps to minPulse-maxPulse
        // If angle is outside 0-180, we still map it linearly
        float us = c.minPulse + (c.currentPos / 180.0f) * (c.maxPulse - c.minPulse);
        
        // 4. Update LEDC Duty
        uint32_t periodUs = 1000000 / c.frequency;
        uint32_t duty = (uint32_t)((us * 65535ULL) / periodUs);
        ledcWrite(p, duty);
    }
}
