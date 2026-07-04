#include "battery.h"
#include <Arduino.h>
#include <Preferences.h>

// Global definitions
int battery_cells = 0;
float battery_r1 = 0.0;
float battery_r2 = 0.0;
float battery_calibration = 1.0;
int battery_pin = -1;
float battery_voltage = 0.0;

static unsigned long lastBatteryUpdate = 0;
static const int BATTERY_UPDATE_INTERVAL = 500; // ms

void setupBattery() {
    prefs.begin("sys_config", true);
    battery_cells = prefs.getInt("bat_cells", 0);
    battery_r1 = prefs.getFloat("bat_r1", 0.0);
    battery_r2 = prefs.getFloat("bat_r2", 0.0);
    battery_calibration = prefs.getFloat("bat_cal", 1.0);
    battery_pin = prefs.getInt("bat_pin", -1);
    prefs.end();

    if (battery_pin != -1) {
        pinMode(battery_pin, INPUT);
    }
}

float getRawBatteryVoltage() {
    if (battery_pin == -1) return 0.0;
    
    // Multisample
    long sum = 0;
    int samples = 20;
    for (int i=0; i<samples; i++) {
        sum += analogReadMilliVolts(battery_pin);
        delay(1);
    }
    float avgMv = (float)sum / samples;
    return avgMv / 1000.0; // Convert to Volts
}

void updateBattery() {
    if (millis() - lastBatteryUpdate < BATTERY_UPDATE_INTERVAL) return;
    lastBatteryUpdate = millis();

    if (battery_pin == -1) {
        battery_voltage = 0.0;
        return;
    }

    float adcVoltage = getRawBatteryVoltage();
    
    // If resistors are not set, assume 1:1 (direct measurement)
    // but usually users won't measure > 3.3V directly.
    // If R1/R2 are 0, maybe user didn't config yet.
    if (battery_r2 <= 0.0) {
        battery_voltage = adcVoltage; // Fallback
    } else {
        // Vin = Vout * (R1 + R2) / R2
        float dividerRatio = (battery_r1 + battery_r2) / battery_r2;
        battery_voltage = adcVoltage * dividerRatio * battery_calibration;
    }
}

void setBatteryConfig(int cells, float r1, float r2) {
    prefs.begin("sys_config", false);
    prefs.putInt("bat_cells", cells);
    prefs.putFloat("bat_r1", r1);
    prefs.putFloat("bat_r2", r2);
    prefs.end();

    battery_cells = cells;
    battery_r1 = r1;
    battery_r2 = r2;
    
    Serial.printf(">> BATTERY CONFIG: Cells=%d, R1=%.1f, R2=%.1f\n", cells, r1, r2);
    updateBattery(); // Immediate update
}

void setBatteryCalibration(float measuredVoltage) {
    if (battery_pin == -1) {
        Serial.println("!! ERR: Battery pin not configured!");
        return;
    }

    float adcVoltage = getRawBatteryVoltage();
    if (adcVoltage < 0.1) {
         Serial.println("!! ERR: ADC voltage too low for calibration!");
         return;
    }
    
    if (battery_r2 <= 0.0) {
        Serial.println("!! ERR: Resistors not configured!");
        return;
    }

    // current_calculated = adc * ratio * cal_old
    // measured = adc * ratio * cal_new
    // cal_new = measured / (adc * ratio)
    
    float dividerRatio = (battery_r1 + battery_r2) / battery_r2;
    float expectedAdc = measuredVoltage / dividerRatio;
    
    // Calculate new calibration factor
    float newCal = measuredVoltage / (adcVoltage * dividerRatio);
    
    prefs.begin("sys_config", false);
    prefs.putFloat("bat_cal", newCal);
    prefs.end();
    
    battery_calibration = newCal;
    Serial.printf(">> BATTERY CALIBRATED: Factor=%.4f (ADC=%.3fV, Real=%.2fV)\n", newCal, adcVoltage, measuredVoltage);
    updateBattery();
}

void setBatteryPin(int pin) {
    prefs.begin("sys_config", false);
    prefs.putInt("bat_pin", pin);
    prefs.end();
    
    battery_pin = pin;
    if (battery_pin != -1) {
        pinMode(battery_pin, INPUT);
    }
    Serial.printf(">> BATTERY PIN SET: %d\n", pin);
}

void reportBatteryConfig() {
    // Format: BATTERY_CFG,cells,r1,r2,cal,pin,voltage
    Serial.printf("BATTERY_CFG,%d,%.1f,%.1f,%.4f,%d,%.2f\n", 
        battery_cells, battery_r1, battery_r2, battery_calibration, battery_pin, battery_voltage);
}
