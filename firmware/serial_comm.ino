#include "config.h"

// --- FUNKCJA SPRAWDZAJĄCA BEZPIECZEŃSTWO PINÓW ---
bool isPinAvailable(int pin, const char* label) {
    if (pin == -1) return true; // -1 jest zawsze dozwolone (wyłączony pin)

    // 1. Blokada pinów systemowych ESP32-C3 (USB Serial)
    if (pin == 20 || pin == 21) {
        Serial.printf("!!! BLAD: Pin %d to port USB/LOGI. Nie mozesz go uzyc!\n", pin);
        return false;
    }

    // 2. Blokada duplikatów MIĘDZY portami oraz wewnątrz portu
    String l = String(label);
    if (l.startsWith("u1")) {
        if (pin != -1 && (pin == u2_rx || pin == u2_tx || pin == u3_rx || pin == u3_tx)) {
            Serial.printf("!!! BLAD: Pin %d jest juz uzywany przez inny port UART!\n", pin);
            return false;
        }
    } else if (l.startsWith("u2")) {
        if (pin != -1 && (pin == u1_rx || pin == u1_tx || pin == u3_rx || pin == u3_tx)) {
            Serial.printf("!!! BLAD: Pin %d jest juz uzywany przez inny port UART!\n", pin);
            return false;
        }
    } else if (l.startsWith("u3")) {
        if (pin != -1 && (pin == u1_rx || pin == u1_tx || pin == u2_rx || pin == u2_tx)) {
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

// --- HELPERY DO ZAPISU ---
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

// Deklaracje funkcji z gps_logic.ino
void configureGps();

String commandBuf = "";

void handleCommands() {
    while (Serial.available() > 0) {
        char c = Serial.read();
        if (c == '\n' || c == '\r') {
            commandBuf.trim();
            if (commandBuf.length() > 0) {
                processCommand(commandBuf);
            }
            commandBuf = "";
        } else {
            commandBuf += c;
        }
    }
}

void processCommand(String cmd) {
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
            delay(100); // Małe opóźnienie dla stabilności
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

        else if (cmd == "FULL_CONFIG") {
            // Device Info (type and firmware version)
            Serial.println("DEVICE,esp32c3,1.0.0");
            // UART Configs
            Serial.printf("UART_CONF,1,%s,%d,%d,%ld,%s\n", u1_enabled?"ENABLED":"DISABLED", u1_rx, u1_tx, u1_baud, u1_type.c_str());
            Serial.printf("UART_CONF,2,%s,%d,%d,%ld,%s\n", u2_enabled?"ENABLED":"DISABLED", u2_rx, u2_tx, u2_baud, u2_type.c_str());
            Serial.printf("UART_CONF,3,%s,%d,%d,%ld,%s\n", u3_enabled?"ENABLED":"DISABLED", u3_rx, u3_tx, u3_baud, u3_type.c_str());

            // Receiver Settings
            Serial.print("RX_SETTINGS,");
            Serial.print(rx_ch_map); Serial.print(",");
            Serial.print(rc_min); Serial.print(",");
            Serial.print(rc_mid); Serial.print(",");
            Serial.print(rc_max); Serial.print(",");
            Serial.print(db_rc); Serial.print(",");
            Serial.print(db_yaw); Serial.print(",");
            Serial.print(db_thr3d); Serial.print(",");
            Serial.print(rc_smooth ? 1 : 0); Serial.print(",");
            Serial.print(rc_smooth_coeff); Serial.print(",");
            Serial.print(steering_ch); Serial.print(",");
            Serial.print(throttle_ch); Serial.print(",");
            Serial.print(steering_rev ? 1 : 0); Serial.print(",");
            Serial.print(throttle_rev ? 1 : 0); Serial.print(",");
            Serial.print(control_mode); Serial.print(",");
            Serial.print(direction_ch); Serial.print(",");
            Serial.print(speed_ch); Serial.print(",");
            Serial.println(dir_pressed_is_reverse ? 1 : 0);

            // GPS Settings
            Serial.print("GPS_SETTINGS,");
            Serial.print(gps_protocol); Serial.print(",");
            Serial.print(gps_auto_config ? 1 : 0); Serial.print(",");
            Serial.print(gps_galileo ? 1 : 0); Serial.print(",");
            Serial.print(gps_home_once ? 1 : 0); Serial.print(",");
            Serial.print(gps_ground_assist); Serial.print(",");
            Serial.println(gps_mag_declination);
        }

        else if (cmd == "RX_SETTINGS") {
            Serial.print("RX_SETTINGS,");
            Serial.print(rx_ch_map); Serial.print(",");
            Serial.print(rc_min); Serial.print(",");
            Serial.print(rc_mid); Serial.print(",");
            Serial.print(rc_max); Serial.print(",");
            Serial.print(db_rc); Serial.print(",");
            Serial.print(db_yaw); Serial.print(",");
            Serial.print(db_thr3d); Serial.print(",");
            Serial.print(rc_smooth ? 1 : 0); Serial.print(",");
            Serial.print(rc_smooth_coeff); Serial.print(",");
            // Car settings: steer_ch, thr_ch, steer_rev, thr_rev
            Serial.print(steering_ch); Serial.print(",");
            Serial.print(throttle_ch); Serial.print(",");
            Serial.print(steering_rev ? 1 : 0); Serial.print(",");
            Serial.print(throttle_rev ? 1 : 0); Serial.print(",");
            Serial.print(control_mode); Serial.print(",");
            Serial.print(direction_ch); Serial.print(",");
            Serial.print(speed_ch); Serial.print(",");
            Serial.println(dir_pressed_is_reverse ? 1 : 0);
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
        else if (cmd.startsWith("SET_CHMAP:")) { saveType("rx_ch_map", cmd.substring(10), rx_ch_map); }
        else if (cmd.startsWith("SET_RC_MIN:")) { saveInt("rc_min", cmd.substring(11).toInt(), rc_min); }
        else if (cmd.startsWith("SET_RC_MID:")) { saveInt("rc_mid", cmd.substring(11).toInt(), rc_mid); }
        else if (cmd.startsWith("SET_RC_MAX:")) { saveInt("rc_max", cmd.substring(11).toInt(), rc_max); }
        else if (cmd.startsWith("SET_DB_RC:")) { saveInt("db_rc", cmd.substring(10).toInt(), db_rc); }
        else if (cmd.startsWith("SET_DB_YAW:")) { saveInt("db_yaw", cmd.substring(11).toInt(), db_yaw); }
        else if (cmd.startsWith("SET_DB_THR3D:")) { saveInt("db_thr3d", cmd.substring(13).toInt(), db_thr3d); }
        else if (cmd.startsWith("SET_RC_SMOOTH:")) { saveEnabled("rc_smooth", cmd.substring(14).toInt() == 1, rc_smooth); }
        else if (cmd.startsWith("SET_RC_SMOOTH_COEFF:")) { saveInt("rc_smooth_coeff", cmd.substring(20).toInt(), rc_smooth_coeff); }

        // Car Control Commands
        else if (cmd.startsWith("SET_STEER_CH:")) { saveInt("steer_ch", cmd.substring(13).toInt(), steering_ch); }
        else if (cmd.startsWith("SET_THR_CH:")) { saveInt("thr_ch", cmd.substring(11).toInt(), throttle_ch); }
        else if (cmd.startsWith("SET_STEER_REV:")) { saveEnabled("steer_rev", cmd.substring(14).toInt() == 1, steering_rev); }
        else if (cmd.startsWith("SET_THR_REV:")) { saveEnabled("thr_rev", cmd.substring(12).toInt() == 1, throttle_rev); }
        else if (cmd.startsWith("SET_CONTROL_MODE:")) { saveType("ctrl_mode", cmd.substring(17), control_mode); }
        else if (cmd.startsWith("SET_DIR_CH:")) { saveInt("dir_ch", cmd.substring(11).toInt(), direction_ch); }
        else if (cmd.startsWith("SET_SPEED_CH:")) { saveInt("spd_ch", cmd.substring(13).toInt(), speed_ch); }
        else if (cmd.startsWith("SET_DIR_POL:")) { saveEnabled("dir_pol", cmd.substring(12).toInt() == 1, dir_pressed_is_reverse); }

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
            configureGps();
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
