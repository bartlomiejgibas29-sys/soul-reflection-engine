#ifndef BATTERY_H
#define BATTERY_H

#include "config.h"

// --- Global Battery Variables (definitions in firmware.ino) ---
extern int battery_cells;        // 0=Auto, 1, 2, 3...
extern float battery_r1;         // Ohms
extern float battery_r2;         // Ohms
extern float battery_calibration;// Multiplier (default 1.0)
extern int battery_pin;          // Pin number (or -1 if disabled)
extern float battery_voltage;    // Runtime voltage

// --- Function Declarations ---
void setupBattery();
void updateBattery(); // Call in loop()
void setBatteryConfig(int cells, float r1, float r2);
void setBatteryCalibration(float measuredVoltage);
void setBatteryPin(int pin);
float getRawBatteryVoltage(); // Helper
void reportBatteryConfig();

#endif
