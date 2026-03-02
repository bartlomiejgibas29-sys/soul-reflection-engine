#include "config.h"

Preferences prefs;

// Globalne zmienne konfiguracji (definicje)
int u1_rx, u1_tx; long u1_baud; String u1_type;
int u2_rx, u2_tx; long u2_baud; String u2_type;
int u3_rx, u3_tx; long u3_baud; String u3_type;

bool u1_enabled, u2_enabled, u3_enabled;

// Receiver settings
// Usunięto nieużywane zmienne: telemetry, rssi_adc, rssi_ch
String rx_ch_map = "AETR1234";
int rc_min = 1000;
int rc_mid = 1500;
int rc_max = 2000;
int db_rc = 0;
int db_yaw = 0;
int db_thr3d = 0;
bool rc_smooth = false;
int rc_smooth_coeff = 30;

// Car Control Settings (Domyślnie: Skręt CH1, Gaz CH2 - typowe dla autek)
int steering_ch = 1;
int throttle_ch = 2;
bool steering_rev = false;
bool throttle_rev = false;

// GPS Settings
String gps_protocol = "UBLOX";
bool gps_auto_config = true;
bool gps_galileo = true;
bool gps_home_once = true;
String gps_ground_assist = "European";
float gps_mag_declination = 0.0;
bool gpsMode = false;
unsigned long lastGpsUpdate = 0;

// Obiekty
SoftwareSerial Serial2;
SoftwareSerial Serial3;
HardwareSerial crsfSerial(1);
AlfredoCRSF crsf;
TinyGPSPlus gps;
unsigned long lastCrsfUpdate = 0;
bool receiverMode = false;

// Deklaracje funkcji z innych plików
void handleCommands();
void handleGpsLoop();
void handleReceiverLoop();

// --- ŁADOWANIE USTAWIEŃ Z PAMIĘCI FLASH ---
void loadSettings() {
    prefs.begin("sys_config", true); 
    
    // Pobierz dane, użyj domyślnych jeśli pamięć jest pusta
    u1_rx = prefs.getInt("u1_rx", 4); u1_tx = prefs.getInt("u1_tx", 5); u1_baud = prefs.getLong("u1_baud", 115200); u1_type = prefs.getString("u1_type", "GENERIC");
    u2_rx = prefs.getInt("u2_rx", 6); u2_tx = prefs.getInt("u2_tx", 7); u2_baud = prefs.getLong("u2_baud", 9600); u2_type = prefs.getString("u2_type", "GENERIC");
    u3_rx = prefs.getInt("u3_rx", 8); u3_tx = prefs.getInt("u3_tx", 9); u3_baud = prefs.getLong("u3_baud", 9600); u3_type = prefs.getString("u3_type", "GENERIC"); 

    // odczytaj stany włączenia portów, domyślnie włączone
    u1_enabled = prefs.getBool("u1_en", true);
    u2_enabled = prefs.getBool("u2_en", true);
    u3_enabled = prefs.getBool("u3_en", true);

    // Jeśli port jest wyłączony, ustawiamy piny na -1 (runtime)
    if (!u1_enabled) { u1_rx = -1; u1_tx = -1; }
    if (!u2_enabled) { u2_rx = -1; u2_tx = -1; }
    if (!u3_enabled) { u3_rx = -1; u3_tx = -1; }

    // Car settings
    rx_ch_map = prefs.getString("rx_ch_map", "AETR1234");
    rc_min = prefs.getInt("rc_min", 1000);
    rc_mid = prefs.getInt("rc_mid", 1500);
    rc_max = prefs.getInt("rc_max", 2000);
    db_rc = prefs.getInt("db_rc", 0);
    db_yaw = prefs.getInt("db_yaw", 0);
    db_thr3d = prefs.getInt("db_thr3d", 0);
    rc_smooth = prefs.getBool("rc_smooth", false);
    rc_smooth_coeff = prefs.getInt("rc_smooth_coeff", 30);

    // Car settings
    steering_ch = prefs.getInt("steer_ch", 1);
    throttle_ch = prefs.getInt("thr_ch", 2);
    steering_rev = prefs.getBool("steer_rev", false);
    throttle_rev = prefs.getBool("thr_rev", false);

    // GPS settings
    gps_protocol = prefs.getString("gps_proto", "UBLOX");
    gps_auto_config = prefs.getBool("gps_auto", true);
    gps_galileo = prefs.getBool("gps_galileo", true);
    gps_home_once = prefs.getBool("gps_home_once", true);
    gps_ground_assist = prefs.getString("gps_assist", "European");
    gps_mag_declination = prefs.getFloat("gps_mag", 0.0);

    prefs.end();
}

void setup() {
    Serial.begin(115200); // Główny port komunikacji z PC 
    
    loadSettings();
    
    // Inicjalizacja portów UART tylko jeśli zostały włączone w ustawieniach
    if (u1_enabled) Serial1.begin(u1_baud, SERIAL_8N1, u1_rx, u1_tx);
    if (u2_enabled) Serial2.begin(u2_baud, SWSERIAL_8N1, u2_rx, u2_tx);
    if (u3_enabled) Serial3.begin(u3_baud, SWSERIAL_8N1, u3_rx, u3_tx);

    // skrócony raport startowy w formacie tabeli CSV
    Serial.println("UART,EN,RX,TX,Baud,Type");
    Serial.printf("U1,%s,%d,%d,%ld,%s\n", u1_enabled?"ENABLED":"DISABLED", u1_rx, u1_tx, u1_baud, u1_type.c_str());
    Serial.printf("U2,%s,%d,%d,%ld,%s\n", u2_enabled?"ENABLED":"DISABLED", u2_rx, u2_tx, u2_baud, u2_type.c_str());
    Serial.printf("U3,%s,%d,%d,%ld,%s\n", u3_enabled?"ENABLED":"DISABLED", u3_rx, u3_tx, u3_baud, u3_type.c_str());
    Serial.println("(użyj STATUS lub PIN_TABLE aby otrzymać dane)");
}

void loop() {
    handleCommands();
    handleGpsLoop();
    handleReceiverLoop();
}
