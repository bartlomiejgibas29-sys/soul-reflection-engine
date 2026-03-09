#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>
#include <Preferences.h>
#include <SoftwareSerial.h> 
#include <AlfredoCRSF.h>
#include <TinyGPSPlus.h>

// --- OBIEKTY GLOBALNE ---
extern Preferences prefs;
extern SoftwareSerial Serial2;
extern SoftwareSerial Serial3;
extern HardwareSerial crsfSerial;
extern AlfredoCRSF crsf;
extern TinyGPSPlus gps;

// --- ZMIENNE KONFIGURACYJNE (deklaracje) ---

// UART 1
extern int u1_rx, u1_tx; 
extern long u1_baud; 
extern String u1_type;
extern bool u1_enabled;

// UART 2
extern int u2_rx, u2_tx; 
extern long u2_baud; 
extern String u2_type;
extern bool u2_enabled;

// UART 3
extern int u3_rx, u3_tx; 
extern long u3_baud; 
extern String u3_type;
extern bool u3_enabled;

// Receiver Settings
extern String rx_ch_map;
extern int rc_min, rc_mid, rc_max;
extern int db_rc, db_yaw, db_thr3d;
extern bool rc_smooth;
extern int rc_smooth_coeff;
// Car Control Settings
extern int steering_ch;
extern int throttle_ch;
extern bool steering_rev;
extern bool throttle_rev;
extern String control_mode;
extern int direction_ch;
extern int speed_ch;
extern bool dir_pressed_is_reverse;

// GPS Settings
extern String gps_protocol;
extern bool gps_auto_config;
extern bool gps_galileo;
extern bool gps_home_once;
extern String gps_ground_assist;
extern float gps_mag_declination;
extern bool gpsMode;
extern unsigned long lastGpsUpdate;
extern unsigned long lastSatUpdate;
extern bool receiverMode;
extern unsigned long lastCrsfUpdate;

// UBX-NAV-SAT satellite info
#define MAX_SAT_COUNT 32
struct SatInfo {
    uint8_t gnssId;
    uint8_t svId;
    uint8_t cno;
    bool used;
    uint8_t quality;
};
extern SatInfo satInfos[MAX_SAT_COUNT];
extern uint8_t satCount;

struct ServoRange {
    int minIn;    // e.g. 900
    int maxIn;    // e.g. 1100
    int targetUs; // e.g. 1500
};

// --- Servo Configuration (Betaflight-style + Ranges) ---
struct ServoConfig {
    int pin;
    int frequency;      // PWM frequency (Hz), typically 50
    int minUs;           // Minimum pulse width (us), e.g. 1000
    int midUs;           // Center pulse width (us), e.g. 1500
    int maxUs;           // Maximum pulse width (us), e.g. 2000
    int sourceChannel;   // 0=None(manual), 1-16=RC Channel
    bool reverse;        // Reverse direction
    float rate;          // Deflection multiplier (1.0 = 100%)
    int speed;           // Speed limit (us/sec, 0=instant)
    float currentUs;     // Current position in microseconds (runtime)
    int lastWrittenUs;   // Last written value to avoid redundant writes
    int mode;            // 0=PROPORTIONAL, 1=RANGES
    ServoRange ranges[5]; // Up to 5 ranges per servo
    int rangeCount;      // Number of active ranges
    int minAngle;        // e.g. 0
    int maxAngle;        // e.g. 180
};
#define MAX_SERVOS 6
extern ServoConfig servoConfigs[MAX_SERVOS];
extern int servoCount;

// --- Pin configuration ---
void initPinConfig();
void reportAllPins();
void reportServoConfigs(); // Added declaration
int findServoIdx(int pin);

#endif
