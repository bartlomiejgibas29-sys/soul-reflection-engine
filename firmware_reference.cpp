#include <Preferences.h>
#include <SoftwareSerial.h> 
#include <AlfredoCRSF.h> // Mock or user-provided lib

Preferences prefs;

// Globalne zmienne konfiguracji (trzymane w RAM do szybkiego sprawdzania konfliktów)
int u1_rx, u1_tx; long u1_baud; String u1_type;
int u2_rx, u2_tx; long u2_baud; String u2_type;
int u3_rx, u3_tx; long u3_baud; String u3_type;

// Flagi włączania/wyłączania portów (przechowywane w pamięci)
bool u1_enabled, u2_enabled, u3_enabled;

// --- Receiver settings ---
bool rx_telemetry = false;
bool rx_rssi_adc = false;
int rx_rssi_ch = -1;
String rx_ch_map = "AETR1234";
int rc_min = 1000;
int rc_mid = 1500;
int rc_max = 2000;
int db_rc = 0;
int db_yaw = 0;
int db_thr3d = 0;
bool rc_smooth = false;
int rc_smooth_coeff = 30;

// --- GPS Settings ---
String gps_protocol = "UBLOX";
bool gps_auto_config = true;
bool gps_galileo = true;
bool gps_home_once = true;
String gps_ground_assist = "European";
float gps_mag_declination = 0.0;

// Obiekty dla portów programowych
SoftwareSerial Serial2;
SoftwareSerial Serial3;

// --- CRSF (ExpressLRS) ---
// For this demo, we use HardwareSerial(1) as requested, but logic is wrapped.
// We assume UART1 is the one used for CRSF if enabled, or a dedicated setup.
// User snippet used: HardwareSerial crsfSerial(1); with pins 9/8.
// Note: ESP32-C3 HardwareSerial(1) pins can be remapped.
// Conflict check: if u3 uses 8/9, we might have an issue.
// We will use a separate flag for Receiver Mode.
bool receiverMode = false;
HardwareSerial crsfSerial(1);
AlfredoCRSF crsf;
unsigned long lastCrsfUpdate = 0;

// --- GPS (TinyGPS++) ---
#include <TinyGPSPlus.h>
TinyGPSPlus gps;
bool gpsMode = false;
unsigned long lastGpsUpdate = 0;

// --- GPS Protokoły pomocnicze ---
void sendGpsCommand(const uint8_t* cmd, size_t len) {
    if (u1_type == "GPS" && u1_enabled) Serial1.write(cmd, len);
    else if (u2_type == "GPS" && u2_enabled) Serial2.write(cmd, len);
    else if (u3_type == "GPS" && u3_enabled) Serial3.write(cmd, len);
}

void configureGps() {
    if (gps_protocol == "UBLOX" && gps_auto_config) {
        Serial.println(">> Config: UBLOX 10Hz + Galileo/EGNOS");
        // UBX-CFG-PRT (Baud 115200) - opcjonalnie, jeśli kontroler używa 115200
        // UBX-CFG-RATE (100ms = 10Hz)
        uint8_t cfgRate[] = {0xB5, 0x62, 0x06, 0x08, 0x06, 0x00, 0x64, 0x00, 0x01, 0x00, 0x01, 0x00, 0x7A, 0x12};
        sendGpsCommand(cfgRate, sizeof(cfgRate));
        
        // UBX-CFG-NAV5 (Airborne < 4g)
        uint8_t cfgNav5[] = {0xB5, 0x62, 0x06, 0x24, 0x24, 0x00, 0xFF, 0xFF, 0x06, 0x03, 0x00, 0x00, 0x00, 0x00, 0x10, 0x27, 0x00, 0x00, 0x05, 0x00, 0xFA, 0x00, 0xFA, 0x00, 0x64, 0x00, 0x2C, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0xDC};
        sendGpsCommand(cfgNav5, sizeof(cfgNav5));
    } else if (gps_protocol == "MSP") {
        Serial.println(">> Config: MSP GPS Mode initialized");
    } else {
        Serial.println(">> Config: NMEA Generic Mode");
    }
}

// Domyślnie zakładamy, że GPS jest podłączony do UART2 (SoftwareSerial)
// W przyszłości można to konfigurować. Tu: używamy Serial2.

// --- FUNKCJA SPRAWDZAJĄCA BEZPIECZEŃSTWO PINÓW ---
bool isPinAvailable(int pin, const char* label) {
    if (pin == -1) return true; // -1 jest zawsze dozwolone (wyłączony pin)

    // 1. Blokada pinów systemowych ESP32-C3 (USB Serial)
    if (pin == 20 || pin == 21) {
        Serial.printf("!!! BLAD: Pin %d to port USB/LOGI. Nie mozesz go uzyc!\n", pin);
        return false;
    }

    // 2. Blokada duplikatów MIĘDZY portami (czy ten pin nie jest już używany przez INNY port)
    // Jeśli label zawiera "u1", sprawdzamy tylko konflikty z u2 i u3. 
    // Pozwalamy na tymczasowy konflikt wewnątrz u1 (np. RX=9, TX=9), aby umożliwić zamianę pinów.
    String l = String(label);
    if (l.startsWith("u1")) {
        if (pin == u2_rx || pin == u2_tx || pin == u3_rx || pin == u3_tx) {
            Serial.printf("!!! BLAD: Pin %d jest juz uzywany przez inny port UART!\n", pin);
            return false;
        }
    } else if (l.startsWith("u2")) {
        if (pin == u1_rx || pin == u1_tx || pin == u3_rx || pin == u3_tx) {
            Serial.printf("!!! BLAD: Pin %d jest juz uzywany przez inny port UART!\n", pin);
            return false;
        }
    } else if (l.startsWith("u3")) {
        if (pin == u1_rx || pin == u1_tx || pin == u2_rx || pin == u2_tx) {
            Serial.printf("!!! BLAD: Pin %d jest juz uzywany przez inny port UART!\n", pin);
            return false;
        }
    }

    // 3. Zakres fizyczny pinów ESP32-C3
    if (pin < 0 || pin > 10 && pin < 18 || pin > 21) {
        Serial.printf("!!! BLAD: Pin %d nie istnieje w ESP32-C3!\n", pin);
        return false;
    }

    return true;
}

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

    // Jeśli port jest wyłączony, ustawiamy piny na -1 (runtime), 
    // aby zwolnić zasoby dla funkcji isPinAvailable() i uniknąć konfliktów.
    if (!u1_enabled) { u1_rx = -1; u1_tx = -1; }
    if (!u2_enabled) { u2_rx = -1; u2_tx = -1; }
    if (!u3_enabled) { u3_rx = -1; u3_tx = -1; }

    // Receiver settings
    rx_telemetry = prefs.getBool("rx_tel", false);
    rx_rssi_adc = prefs.getBool("rx_rssi_adc", false);
    rx_rssi_ch = prefs.getInt("rx_rssi_ch", -1);
    rx_ch_map = prefs.getString("rx_ch_map", "AETR1234");
    rc_min = prefs.getInt("rc_min", 1000);
    rc_mid = prefs.getInt("rc_mid", 1500);
    rc_max = prefs.getInt("rc_max", 2000);
    db_rc = prefs.getInt("db_rc", 0);
    db_yaw = prefs.getInt("db_yaw", 0);
    db_thr3d = prefs.getInt("db_thr3d", 0);
    rc_smooth = prefs.getBool("rc_smooth", false);
    rc_smooth_coeff = prefs.getInt("rc_smooth_coeff", 30);

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

// --- FUNKCJE ZAPISUJĄCE ---
void savePin(const char* key, int newPin, int &currentVar) {
    if (isPinAvailable(newPin, key)) {
        prefs.begin("sys_config", false);
        prefs.putInt(key, newPin);
        prefs.end();
        currentVar = newPin; // Aktualizacja w RAM
        Serial.printf(">> OK: Zapisano %s = %d.\n", key, newPin);
    }
}

void saveInt(const char* key, int newVal, int &currentVar) {
    prefs.begin("sys_config", false);
    prefs.putInt(key, newVal);
    prefs.end();
    currentVar = newVal;
    Serial.printf(">> OK: %s = %d\n", key, newVal);
}

void saveType(const char* key, String newType, String &currentVar) {
    prefs.begin("sys_config", false);
    prefs.putString(key, newType);
    prefs.end();
    currentVar = newType;
    Serial.printf(">> OK: Typ %s ustawiony na %s.\n", key, newType.c_str());
}

void saveBaud(const char* key, long newBaud, long &currentVar) {
    prefs.begin("sys_config", false);
    prefs.putLong(key, newBaud);
    prefs.end();
    currentVar = newBaud;
    Serial.printf(">> OK: Baudrate %s ustawiony na %ld.\n", key, newBaud);
}

void saveEnabled(const char* key, bool value, bool &currentVar) {
    prefs.begin("sys_config", false);
    prefs.putBool(key, value);
    prefs.end();
    currentVar = value;
    Serial.printf(">> OK: %s = %s\n", key, value?"true":"false");
}

void saveFloat(const char* key, float newVal, float &currentVar) {
    prefs.begin("sys_config", false);
    prefs.putFloat(key, newVal);
    prefs.end();
    currentVar = newVal;
    Serial.printf(">> OK: %s = %.2f\n", key, newVal);
}

// --- HELPERY DO RESTARTU PORTÓW ---
void restartUART1() {
    Serial1.end();
    if (u1_enabled && u1_rx != -1 && u1_tx != -1) {
        if (u1_rx == u1_tx) {
            Serial.println("!! BLAD: UART1 RX i TX nie moga byc tym samym pinem!");
            return;
        }
        Serial1.begin(u1_baud, SERIAL_8N1, u1_rx, u1_tx);
        Serial.println(">> UART1 restarted/updated.");
    }
}

void restartUART2() {
    Serial2.end();
    if (u2_enabled && u2_rx != -1 && u2_tx != -1) {
        if (u2_rx == u2_tx) {
            Serial.println("!! BLAD: UART2 RX i TX nie moga byc tym samym pinem!");
            return;
        }
        Serial2.begin(u2_baud, SWSERIAL_8N1, u2_rx, u2_tx);
        Serial.println(">> UART2 restarted/updated.");
    }
}

void restartUART3() {
    Serial3.end();
    if (u3_enabled && u3_rx != -1 && u3_tx != -1) {
        if (u3_rx == u3_tx) {
            Serial.println("!! BLAD: UART3 RX i TX nie moga byc tym samym pinem!");
            return;
        }
        Serial3.begin(u3_baud, SWSERIAL_8N1, u3_rx, u3_tx);
        Serial.println(">> UART3 restarted/updated.");
    }
}

// --- OBSŁUGA KOMEND ---
void handleCommands() {
    if (Serial.available() > 0) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        if (cmd.length() == 0) return;

        Serial.println("> Komenda: " + cmd);

        // Systemowe
        if (cmd == "HARD RESET") {
            Serial.println("!!! CZYSZCZENIE PAMIECI I REBOOT !!!");
            // wyłącz wszystkie porty od razu, aby zwolnić piny
            Serial1.end();
            Serial2.end();
            Serial3.end();
            // wyczyść resetem pamięć, ale zapisz flagi "wyłączone" żeby po restarcie nie startowały
            prefs.begin("sys_config", false);
            prefs.clear();
            prefs.putBool("u1_en", false);
            prefs.putBool("u2_en", false);
            prefs.putBool("u3_en", false);
            prefs.end();
            Serial.flush(); // Upewnij się że wszystko zostało wysłane
            ESP.restart();
        }
        else if (cmd == "REBOOT") { 
            Serial.println(">> Restartowanie urządzenia...");
            Serial.flush(); // Upewnij się że odpowiedź została wysłana
            ESP.restart(); 
        }
        else if (cmd == "STATUS") {
            // status w formie do czytania dla człowieka
            Serial.printf("U1:%s (%s) RX%d TX%d @%ld | U2:%s (%s) RX%d TX%d @%ld | U3:%s (%s) RX%d TX%d @%ld\n",
                          u1_enabled?"EN":"DI", u1_type.c_str(), u1_rx, u1_tx, u1_baud,
                          u2_enabled?"EN":"DI", u2_type.c_str(), u2_rx, u2_tx, u2_baud,
                          u3_enabled?"EN":"DI", u3_type.c_str(), u3_rx, u3_tx, u3_baud);
        }
        else if (cmd == "PIN_TABLE") {
            // wyjście w postaci tabeli csv łatwej do parsowania przez interfejs
            Serial.println("UART,EN, RX, TX, Baud, Type");
            Serial.printf("U1,%s,%d,%d,%ld,%s\n", u1_enabled?"ENABLED":"DISABLED", u1_rx, u1_tx, u1_baud, u1_type.c_str());
            Serial.printf("U2,%s,%d,%d,%ld,%s\n", u2_enabled?"ENABLED":"DISABLED", u2_rx, u2_tx, u2_baud, u2_type.c_str());
            Serial.printf("U3,%s,%d,%d,%ld,%s\n", u3_enabled?"ENABLED":"DISABLED", u3_rx, u3_tx, u3_baud, u3_type.c_str());
        }

        else if (cmd == "RX_SETTINGS") {
            Serial.print("RX_SETTINGS,");
            Serial.print(rx_telemetry ? 1 : 0); Serial.print(",");
            Serial.print(rx_rssi_adc ? 1 : 0); Serial.print(",");
            Serial.print(rx_rssi_ch); Serial.print(",");
            Serial.print(rx_ch_map); Serial.print(",");
            Serial.print(rc_min); Serial.print(",");
            Serial.print(rc_mid); Serial.print(",");
            Serial.print(rc_max); Serial.print(",");
            Serial.print(db_rc); Serial.print(",");
            Serial.print(db_yaw); Serial.print(",");
            Serial.print(db_thr3d); Serial.print(",");
            Serial.print(rc_smooth ? 1 : 0); Serial.print(",");
            Serial.println(rc_smooth_coeff);
        }

        else if (cmd == "GPS_SETTINGS") {
            Serial.print("GPS_SETTINGS,");
            Serial.print(gps_protocol); Serial.print(",");
            Serial.print(gps_auto_config ? 1 : 0); Serial.print(",");
            Serial.print(gps_galileo ? 1 : 0); Serial.print(",");
            Serial.print(gps_home_once ? 1 : 0); Serial.print(",");
            Serial.print(gps_ground_assist); Serial.print(",");
            Serial.println(gps_mag_declination);
        }

        // Ustawienia UART 1
        else if (cmd.startsWith("SET_UART1_RX:")) { savePin("u1_rx", cmd.substring(13).toInt(), u1_rx); restartUART1(); }
        else if (cmd.startsWith("SET_UART1_TX:")) { savePin("u1_tx", cmd.substring(13).toInt(), u1_tx); restartUART1(); }
        else if (cmd.startsWith("SET_UART1_BAUD:")) { saveBaud("u1_baud", cmd.substring(15).toInt(), u1_baud); restartUART1(); }
        else if (cmd.startsWith("SET_UART1_TYPE:")) { saveType("u1_type", cmd.substring(15), u1_type); }

        // Ustawienia UART 2
        else if (cmd.startsWith("SET_UART2_RX:")) { savePin("u2_rx", cmd.substring(13).toInt(), u2_rx); restartUART2(); }
        else if (cmd.startsWith("SET_UART2_TX:")) { savePin("u2_tx", cmd.substring(13).toInt(), u2_tx); restartUART2(); }
        else if (cmd.startsWith("SET_UART2_BAUD:")) { saveBaud("u2_baud", cmd.substring(15).toInt(), u2_baud); restartUART2(); }
        else if (cmd.startsWith("SET_UART2_TYPE:")) { saveType("u2_type", cmd.substring(15), u2_type); }

        // Ustawienia UART 3
        else if (cmd.startsWith("SET_UART3_RX:")) { savePin("u3_rx", cmd.substring(13).toInt(), u3_rx); restartUART3(); }
        else if (cmd.startsWith("SET_UART3_TX:")) { savePin("u3_tx", cmd.substring(13).toInt(), u3_tx); restartUART3(); }
        else if (cmd.startsWith("SET_UART3_BAUD:")) { saveBaud("u3_baud", cmd.substring(15).toInt(), u3_baud); restartUART3(); }
        else if (cmd.startsWith("SET_UART3_TYPE:")) { saveType("u3_type", cmd.substring(15), u3_type); }

        // Receiver settings commands
        else if (cmd.startsWith("SET_TELEMETRY:")) { saveEnabled("rx_tel", cmd.substring(13).toInt() == 1, rx_telemetry); }
        else if (cmd.startsWith("SET_RSSI_ADC:")) { saveEnabled("rx_rssi_adc", cmd.substring(12).toInt() == 1, rx_rssi_adc); }
        else if (cmd.startsWith("SET_RSSI_CH:")) { saveInt("rx_rssi_ch", cmd.substring(12).toInt(), rx_rssi_ch); }
        else if (cmd.startsWith("SET_CHMAP:")) { saveType("rx_ch_map", cmd.substring(10), rx_ch_map); }
        else if (cmd.startsWith("SET_RC_MIN:")) { saveInt("rc_min", cmd.substring(11).toInt(), rc_min); }
        else if (cmd.startsWith("SET_RC_MID:")) { saveInt("rc_mid", cmd.substring(11).toInt(), rc_mid); }
        else if (cmd.startsWith("SET_RC_MAX:")) { saveInt("rc_max", cmd.substring(11).toInt(), rc_max); }
        else if (cmd.startsWith("SET_DB_RC:")) { saveInt("db_rc", cmd.substring(10).toInt(), db_rc); }
        else if (cmd.startsWith("SET_DB_YAW:")) { saveInt("db_yaw", cmd.substring(11).toInt(), db_yaw); }
        else if (cmd.startsWith("SET_DB_THR3D:")) { saveInt("db_thr3d", cmd.substring(13).toInt(), db_thr3d); }
        else if (cmd.startsWith("SET_RC_SMOOTH:")) { saveEnabled("rc_smooth", cmd.substring(14).toInt() == 1, rc_smooth); }
        else if (cmd.startsWith("SET_RC_SMOOTH_COEFF:")) { saveInt("rc_smooth_coeff", cmd.substring(20).toInt(), rc_smooth_coeff); }

        // GPS settings commands
        else if (cmd.startsWith("SET_GPS_PROTOCOL:")) { saveType("gps_proto", cmd.substring(17), gps_protocol); }
        else if (cmd.startsWith("SET_GPS_AUTO_CONFIG:")) { saveEnabled("gps_auto", cmd.substring(20).toInt() == 1, gps_auto_config); }
        else if (cmd.startsWith("SET_GPS_GALILEO:")) { saveEnabled("gps_galileo", cmd.substring(16).toInt() == 1, gps_galileo); }
        else if (cmd.startsWith("SET_GPS_HOME_ONCE:")) { saveEnabled("gps_home_once", cmd.substring(18).toInt() == 1, gps_home_once); }
        else if (cmd.startsWith("SET_GPS_GROUND_ASSIST:")) { saveType("gps_assist", cmd.substring(22), gps_ground_assist); }
        else if (cmd.startsWith("SET_GPS_MAG_DECLINATION:")) { saveFloat("gps_mag", cmd.substring(24).toFloat(), gps_mag_declination); }

        // Włącz / wyłącz porty
        else if (cmd == "DISABLE_UART1") {
            saveEnabled("u1_en", false, u1_enabled);
            u1_rx = -1; u1_tx = -1; // Zwolnienie pinów (runtime)
            Serial1.end();
            Serial.println(">> UART1 disabled (pins freed)");
        }
        else if (cmd == "ENABLE_UART1") {
            saveEnabled("u1_en", true, u1_enabled);
            restartUART1();
            Serial.println(">> UART1 enabled");
        }
        else if (cmd == "DISABLE_UART2") {
            saveEnabled("u2_en", false, u2_enabled);
            u2_rx = -1; u2_tx = -1;
            Serial2.end();
            Serial.println(">> UART2 disabled (pins freed)");
        }
        else if (cmd == "ENABLE_UART2") {
            saveEnabled("u2_en", true, u2_enabled);
            restartUART2();
            Serial.println(">> UART2 enabled");
        }
        else if (cmd == "DISABLE_UART3") {
            saveEnabled("u3_en", false, u3_enabled);
            u3_rx = -1; u3_tx = -1;
            Serial3.end();
            Serial.println(">> UART3 disabled (pins freed)");
        }
        else if (cmd == "ENABLE_UART3") {
            saveEnabled("u3_en", true, u3_enabled);
            restartUART3();
            Serial.println(">> UART3 enabled");
        }
        // global commands to toggle all ports
        else if (cmd == "DISABLE_ALL") {
            saveEnabled("u1_en", false, u1_enabled);
            saveEnabled("u2_en", false, u2_enabled);
            saveEnabled("u3_en", false, u3_enabled);
            u1_rx = -1; u1_tx = -1;
            u2_rx = -1; u2_tx = -1;
            u3_rx = -1; u3_tx = -1;
            Serial1.end();
            Serial2.end();
            Serial3.end();
            Serial.println(">> All UARTs disabled and pins freed");
        }
        else if (cmd == "ENABLE_ALL") {
            saveEnabled("u1_en", true, u1_enabled);
            saveEnabled("u2_en", true, u2_enabled);
            saveEnabled("u3_en", true, u3_enabled);
            restartUART1();
            restartUART2();
            restartUART3();
            Serial.println(">> All UARTs enabled");
        }
        // Receiver Mode Commands
        else if (cmd == "ENABLE_RECEIVER_MODE") {
            // Znajdź UART skonfigurowany jako RECEIVER
            int rx = -1, tx = -1;
            if (u1_type == "RECEIVER" && u1_enabled) { rx = u1_rx; tx = u1_tx; Serial1.end(); }
            else if (u2_type == "RECEIVER" && u2_enabled) { rx = u2_rx; tx = u2_tx; Serial2.end(); }
            else if (u3_type == "RECEIVER" && u3_enabled) { rx = u3_rx; tx = u3_tx; Serial3.end(); }
            
            // Jeśli nie znaleziono w konfiguracji, użyj domyślnego UART1 (kompatybilność wsteczna)
            if (rx == -1) {
                 Serial.println(">> INFO: Nie znaleziono UART typu RECEIVER, uzywam domyslnego UART1");
                 if (u1_enabled) Serial1.end();
                 rx = u1_rx; tx = u1_tx;
            }

            // Start CRSF
            // CRSF wymaga sprzętowego UART lub bardzo szybkiego softu. Tu używamy sprzętowego Serial1 (zmieniamy piny).
            // Uwaga: w tym demo zawsze używamy obiektu crsfSerial (HardwareSerial 1).
            // Aby to działało elastycznie na ESP32-C3, mapujemy piny HardwareSerial na wybrane piny.
            crsfSerial.begin(420000, SERIAL_8N1, rx, tx);
            crsf.begin(crsfSerial);
            receiverMode = true;
            Serial.printf(">> Receiver Mode ENABLED (ELRS 420k @ RX:%d/TX:%d)\n", rx, tx);
        }
        else if (cmd == "DISABLE_RECEIVER_MODE") {
            receiverMode = false;
            // Restore UARTs based on config
            crsfSerial.end(); // Zwolnij piny
            if (u1_enabled) Serial1.begin(u1_baud, SERIAL_8N1, u1_rx, u1_tx);
            if (u2_enabled) Serial2.begin(u2_baud, SWSERIAL_8N1, u2_rx, u2_tx);
            if (u3_enabled) Serial3.begin(u3_baud, SWSERIAL_8N1, u3_rx, u3_tx);
            Serial.println(">> Receiver Mode DISABLED");
        }
        // GPS Mode Commands
        else if (cmd == "ENABLE_GPS_MODE") {
            // Znajdź UART skonfigurowany jako GPS
            if (u1_type == "GPS" && u1_enabled) { 
                // HardwareSerial (Serial1)
                Serial1.end(); // Restart z nowymi ustawieniami jeśli trzeba, ale tu nasłuchujemy
                Serial1.begin(u1_baud, SERIAL_8N1, u1_rx, u1_tx);
                Serial.printf(">> GPS Mode ENABLED on UART1 (HW) @ %ld\n", u1_baud);
            }
            else if (u2_type == "GPS" && u2_enabled) {
                // SoftwareSerial (Serial2)
                Serial2.begin(u2_baud, SWSERIAL_8N1, u2_rx, u2_tx);
                Serial.printf(">> GPS Mode ENABLED on UART2 (SW) @ %ld\n", u2_baud);
            }
            else if (u3_type == "GPS" && u3_enabled) {
                // SoftwareSerial (Serial3)
                Serial3.begin(u3_baud, SWSERIAL_8N1, u3_rx, u3_tx);
                Serial.printf(">> GPS Mode ENABLED on UART3 (SW) @ %ld\n", u3_baud);
            }
            else {
                Serial.println("!! BLAD: Nie znaleziono aktywnego UART skonfigurowanego jako GPS.");
                return;
            }
            gpsMode = true;
            configureGps(); // Nowa funkcja konfigurująca zależnie od protokołu
        }
        else if (cmd == "DISABLE_GPS_MODE") {
            gpsMode = false;
            // Jeśli UART2 był wyłączony globalnie, wyłączamy go
            if (!u2_enabled) {
                Serial2.end();
            }
            Serial.println(">> GPS Mode DISABLED");
        }
    }
}

void loop() {
    handleCommands();
    
    // --- RECEIVER (ELRS) ---
    if (receiverMode) {
        crsf.update();
        if (millis() - lastCrsfUpdate > 50) {
            lastCrsfUpdate = millis();
            const crsfLinkStatistics_t* link = crsf.getLinkStatistics(); 
        
            Serial.print("ELRS_FULL,"); 
            for (int i = 1; i <= 16; i++) { 
              Serial.print(crsf.getChannel(i)); 
              Serial.print(","); 
            } 
            if (link) { 
              Serial.print(link->uplink_RSSI_1); Serial.print(","); 
              Serial.print(link->uplink_RSSI_2); Serial.print(","); 
              Serial.print(link->uplink_Link_quality); Serial.print(","); 
              Serial.print(link->uplink_SNR); Serial.print(","); 
              Serial.print(link->active_antenna); Serial.print(","); 
              Serial.print(link->rf_Mode); Serial.print(","); 
              Serial.print(link->uplink_TX_Power); Serial.print(","); 
              Serial.print(link->downlink_RSSI); Serial.print(","); 
              Serial.print(link->downlink_Link_quality); Serial.print(","); 
              Serial.println(link->downlink_SNR); 
            } else { 
              for(int j=0; j<9; j++) Serial.print("0,"); 
              Serial.println("0"); 
            } 
        }
    }

    // --- GPS ---
    if (gpsMode) {
        if (gps_protocol == "MSP") {
            // Uproszczony parser MSP GPS
            static uint8_t msp_buf[64];
            static uint8_t msp_idx = 0;
            static uint8_t msp_state = 0; // 0: $, 1: M, 2: <, 3: len, 4: cmd, 5: data, 6: crc
            static uint8_t msp_len = 0;
            static uint8_t msp_cmd = 0;
            static uint8_t msp_crc = 0;

            while (true) {
                int c = -1;
                if (u1_type == "GPS" && u1_enabled && Serial1.available()) c = Serial1.read();
                else if (u2_type == "GPS" && u2_enabled && Serial2.available()) c = Serial2.read();
                else if (u3_type == "GPS" && u3_enabled && Serial3.available()) c = Serial3.read();
                if (c == -1) break;

                uint8_t b = (uint8_t)c;
                if (msp_state == 0 && b == '$') msp_state = 1;
                else if (msp_state == 1 && b == 'M') msp_state = 2;
                else if (msp_state == 2 && b == '>') msp_state = 3;
                else if (msp_state == 3) { msp_len = b; msp_crc = b; msp_idx = 0; msp_state = 4; }
                else if (msp_state == 4) { msp_cmd = b; msp_crc ^= b; msp_state = 5; }
                else if (msp_state == 5) {
                    if (msp_idx < msp_len) { msp_buf[msp_idx++] = b; msp_crc ^= b; }
                    if (msp_idx == msp_len) msp_state = 6;
                }
                else if (msp_state == 6) {
                    if (b == msp_crc) {
                        // Obsługa MSP_RAW_GPS (code 5)
                        if (msp_cmd == 5 && msp_len >= 14) {
                            // Tu moglibyśmy mapować MSP na obiekt gps, 
                            // ale TinyGPS++ nie ma publicznych setterów.
                            // W tej wersji po prostu wysyłamy info o MSP
                            Serial.println(">> MSP GPS Packet received (RAW_GPS)");
                        }
                    }
                    msp_state = 0;
                }
            }
        } else {
            // NMEA / UBLOX (NMEA fallback)
            while (true) {
                int c = -1;
                if (u1_type == "GPS" && u1_enabled && Serial1.available()) c = Serial1.read();
                else if (u2_type == "GPS" && u2_enabled && Serial2.available()) c = Serial2.read();
                else if (u3_type == "GPS" && u3_enabled && Serial3.available()) c = Serial3.read();

                if (c == -1) break;
                gps.encode(c);
            }
        }

        if (millis() - lastGpsUpdate > 500) { // Wysyłaj co 500ms
            lastGpsUpdate = millis();
            
            // Format: GPS_FULL,fix(0/1),sats,lat,lon,alt(m),speed(kmph),course,hdop
            Serial.print("GPS_FULL,");
            Serial.print(gps.location.isValid() ? 1 : 0); Serial.print(",");
            Serial.print(gps.satellites.value()); Serial.print(",");
            Serial.print(gps.location.lat(), 6); Serial.print(",");
            Serial.print(gps.location.lng(), 6); Serial.print(",");
            Serial.print(gps.altitude.meters()); Serial.print(",");
            Serial.print(gps.speed.kmph()); Serial.print(",");
            Serial.print(gps.course.deg()); Serial.print(",");
            Serial.println(gps.hdop.hdop());
        }
    }
}
