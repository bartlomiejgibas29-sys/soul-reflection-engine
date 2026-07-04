#include "config.h"

static int steeringPin = -1;
static unsigned long steeringLastValidDataMs = 0;
static bool steeringFailsafeActive = false;

// Convert microseconds to LEDC duty (same as servo_logic)
static void writeSteeringUs(int pin, int frequency, float us) {
  uint32_t periodUs = 1000000UL / frequency;
  uint32_t duty = (uint32_t)((us * 4095ULL) / periodUs);
  ledcWrite(pin, duty);
}

void initSteering() {
  // Find which pin is configured as STEERING
  for (int i = 0; i < 22; i++) {
    extern uint8_t pinModeArr[22];
    if (pinModeArr[i] == 3) { // 3 = STEERING mode
      steeringPin = i;
      // Attach LEDC for steering
      if (!ledcAttach(steeringPin, 50, 12)) {
        Serial.printf("!! LEDC Attach FAILED for steering on pin %d\n", steeringPin);
      } else {
        Serial.printf(">> Steering initialized on pin %d\n", steeringPin);
        // Set neutral immediately on init
        writeSteeringUs(steeringPin, 50, (float)rc_mid);
      }
      break;
    }
  }
  steeringLastValidDataMs = 0;
  steeringFailsafeActive = false;
}

void handleSteering() {
  if (steeringPin == -1) return; // No steering pin configured
  if (!receiverMode) return;     // Receiver mode not active

  extern uint8_t pinModeArr[22];
  if (pinModeArr[steeringPin] != 3) {
    steeringPin = -1; // Pin no longer in steering mode
    return;
  }

  // Check if we have fresh receiver data at all
  bool freshData = (millis() - lastCrsfUpdate) < 500;
  int rcVal = crsf.getChannel(steering_ch);
  bool validRange = rcVal >= 800 && rcVal <= 2200;

  if (freshData && validRange) {
    steeringLastValidDataMs = millis();
    if (steeringFailsafeActive) {
      steeringFailsafeActive = false;
      Serial.println(">> Steering failsafe released");
    }

    float deflection = (float)(rcVal - rc_mid);
    if (steering_rev) deflection = -deflection;
    float targetUs = (float)rc_mid + deflection;
    if (targetUs < rc_min) targetUs = rc_min;
    if (targetUs > rc_max) targetUs = rc_max;
    writeSteeringUs(steeringPin, 50, targetUs);
  } else if (!steeringFailsafeActive && (millis() - steeringLastValidDataMs) > 500) {
    steeringFailsafeActive = true;
    Serial.println(">> Steering failsafe triggered: return to neutral");
    writeSteeringUs(steeringPin, 50, (float)rc_mid);
  }
}
