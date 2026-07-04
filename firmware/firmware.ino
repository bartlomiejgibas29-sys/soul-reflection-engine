#include "config.h"
#include "battery.h"

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
// Tryb sterowania i kanały dla trybu kierunek+prędkość
String control_mode = "PROPORTIONAL"; // lub "DIRECTION_SELECTED"
int direction_ch = 5; // domyślnie AUX1
int speed_ch = 2;     // domyślnie CH2
bool dir_pressed_is_reverse = false; // domyślnie: wciśnięty = przód

// GPS Settings
String gps_protocol = "UBLOX";
bool gps_auto_config = true;
bool gps_galileo = true;
bool gps_home_once = true;
String gps_ground_assist = "European";
float gps_mag_declination = 0.0;
bool gps_module_enabled = true;
bool gpsMode = false;
bool gpsTelemetry = false;
unsigned long lastGpsUpdate = 0;
unsigned long lastSatUpdate = 0;

// UBX-NAV-SAT data
SatInfo satInfos[MAX_SAT_COUNT];
uint8_t satCount = 0;

// Servo config storage
ServoConfig servoConfigs[MAX_SERVOS];
int servoCount = 0;
int motor_rpwm_pin = -1;
int motor_lpwm_pin = -1;
int motor_en_pin = -1;
int motor_pwm_freq = 20000;
int motor_max_pwm_percent = 100;
int motor_startup_pwm_percent = 0;
int motor_ramp_up_ms = 200;
int motor_ramp_down_ms = 200;
int motor_direction_change_ms = 250;
int motor_direction_smoothing = 50;
bool motor_configured = false;
bool motor_live_test_active = false;
bool motor_failsafe_triggered = false;
bool motorTelemetry = false;
int motor_live_target_percent = 0;
float motor_current_output_percent = 0.0f;

// Obiekty
SoftwareSerial Serial2;
SoftwareSerial Serial3;
HardwareSerial crsfSerial(1);
AlfredoCRSF crsf;
TinyGPSPlus gps;
unsigned long lastCrsfUpdate = 0;
bool receiverMode = false;
bool receiverTelemetry = false;

// Deklaracje funkcji z innych plików
void handleCommands();
void handleGpsLoop();
void handleReceiverLoop();
void handleServoLoop();
void configureGps();
void initPinConfig();
void initMotorDriver();
void handleMotorLoop();

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
    control_mode = prefs.getString("ctrl_mode", "PROPORTIONAL");
    direction_ch = prefs.getInt("dir_ch", 5);
    speed_ch = prefs.getInt("spd_ch", 2);
    dir_pressed_is_reverse = prefs.getBool("dir_pol", false);

    // GPS settings
    gps_protocol = prefs.getString("gps_proto", "UBLOX");
    gps_auto_config = prefs.getBool("gps_auto", true);
    gps_galileo = prefs.getBool("gps_galileo", true);
    gps_home_once = prefs.getBool("gps_home_once", true);
    gps_ground_assist = prefs.getString("gps_assist", "European");
    gps_mag_declination = prefs.getFloat("gps_mag", 0.0);
    gps_module_enabled = prefs.getBool("gps_mod_en", true);

    // Motor settings
    motor_rpwm_pin = prefs.getInt("mot_rpwm", -1);
    motor_lpwm_pin = prefs.getInt("mot_lpwm", -1);
    motor_en_pin = prefs.getInt("mot_en", -1);
    motor_pwm_freq = prefs.getInt("mot_freq", 20000);
    motor_max_pwm_percent = prefs.getInt("mot_max", 100);
    motor_startup_pwm_percent = prefs.getInt("mot_start", 0);
    motor_ramp_up_ms = prefs.getInt("mot_rup", 200);
    motor_ramp_down_ms = prefs.getInt("mot_rdn", 200);
    motor_direction_change_ms = prefs.getInt("mot_dirchg", 250);
    motor_direction_smoothing = prefs.getInt("mot_dirs", 50);
    motor_configured = motor_rpwm_pin >= 0 && motor_lpwm_pin >= 0;

    // Load Servo Configs
    servoCount = prefs.getInt("srv_count", 0);
    if (servoCount < 0) servoCount = 0;
    if (servoCount > MAX_SERVOS) servoCount = MAX_SERVOS;
    for (int i = 0; i < servoCount; i++) {
        String base = "srv_" + String(i) + "_";
        servoConfigs[i].pin = prefs.getInt((base + "pin").c_str(), -1);
        servoConfigs[i].frequency = prefs.getInt((base + "frq").c_str(), 50);
        servoConfigs[i].minUs = prefs.getInt((base + "min").c_str(), 1000);
        servoConfigs[i].midUs = prefs.getInt((base + "mid").c_str(), 1500);
        servoConfigs[i].maxUs = prefs.getInt((base + "max").c_str(), 2000);
        servoConfigs[i].sourceChannel = prefs.getInt((base + "src").c_str(), 0);
        servoConfigs[i].reverse = prefs.getBool((base + "rev").c_str(), false);
        servoConfigs[i].rate = prefs.getFloat((base + "rate").c_str(), 1.0f);
        servoConfigs[i].speed = prefs.getInt((base + "spd").c_str(), 0);
        servoConfigs[i].mode = prefs.getInt((base + "mode").c_str(), 0);
        servoConfigs[i].minAngle = prefs.getInt((base + "angMin").c_str(), 0);
        servoConfigs[i].maxAngle = prefs.getInt((base + "angMax").c_str(), 180);
        
        // Load ranges
        servoConfigs[i].rangeCount = prefs.getInt((base + "rngCnt").c_str(), 0);
        if (servoConfigs[i].rangeCount > 5) servoConfigs[i].rangeCount = 5;
        for (int r = 0; r < servoConfigs[i].rangeCount; r++) {
            String rBase = base + "r" + String(r) + "_";
            servoConfigs[i].ranges[r].minIn = prefs.getInt((rBase + "min").c_str(), 0);
            servoConfigs[i].ranges[r].maxIn = prefs.getInt((rBase + "max").c_str(), 0);
            servoConfigs[i].ranges[r].targetUs = prefs.getInt((rBase + "tgt").c_str(), 1500);
        }

        servoConfigs[i].currentUs = (float)servoConfigs[i].midUs;
        servoConfigs[i].lastWrittenUs = 0;
    }

    prefs.end();
}

void setup() {
    Serial.begin(115200); // Główny port komunikacji z PC 
    
    loadSettings();
    initPinConfig();
    setupBattery();
    initSteering();
    initThrottle();
    initMotorDriver();
    
    // Inicjalizacja portów UART tylko jeśli zostały włączone w ustawieniach
    if (u1_enabled) Serial1.begin(u1_baud, SERIAL_8N1, u1_rx, u1_tx);
    if (u2_enabled) Serial2.begin(u2_baud, SWSERIAL_8N1, u2_rx, u2_tx);
    if (u3_enabled) Serial3.begin(u3_baud, SWSERIAL_8N1, u3_rx, u3_tx);

    // Automatyczne uruchomienie trybu odbiornika, jeśli UART1 jest skonfigurowany jako RECEIVER
    if (u1_enabled && u1_type == "RECEIVER") {
        Serial1.end(); // Zwolnij HardwareSerial(1) dla CRSF
        crsfSerial.begin(420000, SERIAL_8N1, u1_rx, u1_tx);
        crsf.begin(crsfSerial);
        receiverMode = true;
        Serial.println(">> AUTO-START: Receiver Mode ENABLED on UART1");
    }

    // Automatyczne włączenie obsługi GPS jeśli skonfigurowano
    if (gps_module_enabled && ((u1_enabled && u1_type == "GPS") || (u2_enabled && u2_type == "GPS") || (u3_enabled && u3_type == "GPS"))) {
        gpsMode = true;
        configureGps(); // Wymuś konfigurację (10Hz, Galileo itp.)
        Serial.println(">> AUTO-START: GPS Mode ENABLED");
    }

    // Raport startowy w tym samym formacie co PIN_TABLE / FULL_CONFIG
    Serial.printf("UART_CONF,1,%s,%d,%d,%ld,%s\n", u1_enabled?"ENABLED":"DISABLED", u1_rx, u1_tx, u1_baud, u1_type.c_str());
    Serial.printf("UART_CONF,2,%s,%d,%d,%ld,%s\n", u2_enabled?"ENABLED":"DISABLED", u2_rx, u2_tx, u2_baud, u2_type.c_str());
    Serial.printf("UART_CONF,3,%s,%d,%d,%ld,%s\n", u3_enabled?"ENABLED":"DISABLED", u3_rx, u3_tx, u3_baud, u3_type.c_str());
}

void loop() {
    handleCommands();
    handleGpsLoop();
    handleReceiverLoop();
    handleSteering();
    handleThrottle();
    handleServoLoop();
    handleMotorLoop();
    updateBattery();
}
