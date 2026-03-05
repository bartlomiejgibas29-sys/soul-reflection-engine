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
extern int steering_ch; // Numer kanału dla skrętu (1-16)
extern int throttle_ch; // Numer kanału dla gazu (1-16)
extern bool steering_rev; // Odwrócenie skrętu
extern bool throttle_rev; // Odwrócenie gazu
// Tryb sterowania i kanały dla trybu kierunek+prędkość
extern String control_mode; // "PROPORTIONAL" | "DIRECTION_SELECTED"
extern int direction_ch;    // Kanał wyboru kierunku
extern int speed_ch;        // Kanał prędkości
extern bool dir_pressed_is_reverse; // true: wciśnięty = wstecz; false: spoczynek = wstecz


// GPS Settings
extern String gps_protocol;
extern bool gps_auto_config;
extern bool gps_galileo;
extern bool gps_home_once;
extern String gps_ground_assist;
extern float gps_mag_declination;
extern bool gpsMode;
extern unsigned long lastGpsUpdate;

#endif
