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

uint8_t pinModeArr[22];
int pinValArr[22];

static bool isValidUserPin(int pin) {
    if (pin == 20 || pin == 21) return false;
    if (pin >= 0 && pin <= 10) return true;
    if (pin >= 18 && pin <= 21) return true;
    return false;
}

static void servoDetachIfAny(int pin) {
    if (pin < 0 || pin >= 22) return;
    if (pinModeArr[pin] == 2) {
        ledcDetach(pin);
    }
}

static void applyPinRuntime(int pin, uint8_t mode, int value) {
    if (!isValidUserPin(pin)) return;
    servoDetachIfAny(pin);
    if (mode == 0) {
        pinMode(pin, INPUT);
    } else if (mode == 1) {
        pinMode(pin, OUTPUT);
        digitalWrite(pin, value ? HIGH : LOW);
    } else if (mode == 2) {
        // Servo mode: attach LEDC and center
        int freq = 50;
        int midUs = 1500;
        int idx = findServoIdx(pin);
        if (idx >= 0) {
            freq = servoConfigs[idx].frequency;
            midUs = servoConfigs[idx].midUs;
        }
        ledcAttach(pin, freq, 16);
        uint32_t periodUs = 1000000UL / freq;
        uint32_t duty = (uint32_t)(((uint32_t)midUs * 65535ULL) / periodUs);
        ledcWrite(pin, duty);
        if (idx >= 0) {
            servoConfigs[idx].currentUs = (float)midUs;
            servoConfigs[idx].lastWrittenUs = midUs;
        }
    } else if (mode == 3) {
        pinMode(pin, OUTPUT);
        digitalWrite(pin, LOW);
    }
}

void initPinConfig() {
    for (int i = 0; i < 22; i++) {
        pinModeArr[i] = 0;
        pinValArr[i] = 0;
    }
    int steeringFound = -1;
    int pinsToInit[] = {0,1,2,3,4,5,6,7,8,9,10,20,21};
    for (unsigned i = 0; i < sizeof(pinsToInit)/sizeof(pinsToInit[0]); i++) {
        int p = pinsToInit[i];
        int m = 0;
        int v = 0;
        prefs.begin("sys_config", true);
        m = prefs.getInt((String("pin_mode_") + String(p)).c_str(), 0);
        v = prefs.getInt((String("pin_val_") + String(p)).c_str(), 0);
        prefs.end();
        if (m == 3) {
            if (steeringFound == -1) steeringFound = p;
            else m = 0;
        }
        pinModeArr[p] = (uint8_t)m;
        pinValArr[p] = v;
        applyPinRuntime(p, pinModeArr[p], pinValArr[p]);
    }
}

void reportAllPins() {
    int pinsToInit[] = {0,1,2,3,4,5,6,7,8,9,10,20,21};
    for (unsigned i = 0; i < sizeof(pinsToInit)/sizeof(pinsToInit[0]); i++) {
        int p = pinsToInit[i];
        const char* modeStr = "DISABLED";
        if (pinModeArr[p] == 1) modeStr = "LIGHT";
        else if (pinModeArr[p] == 2) modeStr = "SERVO";
        else if (pinModeArr[p] == 3) modeStr = "STEERING";
        Serial.printf("PIN_CONF,%d,%s,%d\n", p, modeStr, pinValArr[p]);
    }
}

static void persistPin(int pin) {
    prefs.begin("sys_config", false);
    prefs.putInt((String("pin_mode_") + String(pin)).c_str(), pinModeArr[pin]);
    prefs.putInt((String("pin_val_") + String(pin)).c_str(), pinValArr[pin]);
    prefs.end();
}

static void setPinModeCommand(int pin, const String& modeStr, int valueOpt, bool hasValue) {
    if (!isValidUserPin(pin)) {
        Serial.printf("PIN_CONF,%d,DISABLED,0\n", pin);
        return;
    }
    if ((pin == u1_rx || pin == u1_tx) && u1_enabled) { Serial.printf("PIN_CONF,%d,%s,%d\n", pin, "DISABLED", 0); return; }
    if ((pin == u2_rx || pin == u2_tx) && u2_enabled) { Serial.printf("PIN_CONF,%d,%s,%d\n", pin, "DISABLED", 0); return; }
    if ((pin == u3_rx || pin == u3_tx) && u3_enabled) { Serial.printf("PIN_CONF,%d,%s,%d\n", pin, "DISABLED", 0); return; }
    uint8_t m = 0;
    if (modeStr == "DISABLED") m = 0;
    else if (modeStr == "LIGHT") m = 1;
    else if (modeStr == "SERVO") m = 2;
    else if (modeStr == "STEERING") m = 3;
    int v = hasValue ? valueOpt : 0;
    if (m == 3) {
        for (int i = 0; i < 22; i++) {
            if (pinModeArr[i] == 3 && i != pin) {
                pinModeArr[i] = 0;
                pinValArr[i] = 0;
                applyPinRuntime(i, 0, 0);
                persistPin(i);
                Serial.printf("PIN_CONF,%d,DISABLED,0\n", i);
            }
        }
    }
    pinModeArr[pin] = m;
    pinValArr[pin] = v;
    applyPinRuntime(pin, m, v);
    persistPin(pin);
    const char* ms = "DISABLED";
    if (m == 1) ms = "LIGHT";
    else if (m == 2) ms = "SERVO";
    else if (m == 3) ms = "STEERING";
    Serial.printf("PIN_CONF,%d,%s,%d\n", pin, ms, v);
}

// --- SERVO CONFIGURATION HELPERS ---
static void persistServo(int idx) {
    if (idx < 0 || idx >= servoCount) return;
    prefs.begin("sys_config", false);
    String base = "srv_" + String(idx) + "_";
    ServoConfig &c = servoConfigs[idx];
    prefs.putInt((base + "pin").c_str(), c.pin);
    prefs.putInt((base + "frq").c_str(), c.frequency);
    prefs.putInt((base + "min").c_str(), c.minUs);
    prefs.putInt((base + "mid").c_str(), c.midUs);
    prefs.putInt((base + "max").c_str(), c.maxUs);
    prefs.putInt((base + "src").c_str(), c.sourceChannel);
    prefs.putBool((base + "rev").c_str(), c.reverse);
    prefs.putFloat((base + "rate").c_str(), c.rate);
    prefs.putInt((base + "spd").c_str(), c.speed);
    prefs.putInt("srv_count", servoCount);
    prefs.end();
}

static void setPinModeCommand(String cmd) {
    // Format: SET_PIN_MODE:pin:MODE[:value]
    int c1 = cmd.indexOf(':');
    int c2 = cmd.indexOf(':', c1 + 1);
    int c3 = cmd.indexOf(':', c2 + 1);
    int pin = cmd.substring(c1 + 1, c2).toInt();
    String mode = (c3 == -1) ? cmd.substring(c2 + 1) : cmd.substring(c2 + 1, c3);
    int val = (c3 == -1) ? 0 : cmd.substring(c3 + 1).toInt();
    setPinModeCommand(pin, mode, val, (c3 != -1));
}

// Report servo configs: SERVO_CFG,pin,freq,minUs,midUs,maxUs,src,reverse,rate,speed
void reportServoConfigs() {
    for (int i = 0; i < servoCount; i++) {
        ServoConfig &c = servoConfigs[i];
        Serial.printf("SERVO_CFG,%d,%d,%d,%d,%d,%d,%d,%.2f,%d\n",
            c.pin, c.frequency, c.minUs, c.midUs, c.maxUs,
            c.sourceChannel, c.reverse ? 1 : 0, c.rate, c.speed);
    }
}

void setServoConfigCommand(String cmd) {
    // Format: SET_SERVO_CFG:pin:freq:min:max:speed:src:npts[:i1:o1:p1:i2:o2:p2...]
    int numParts = 1;
    for (int i = 0; i < cmd.length(); i++) if (cmd[i] == ':') numParts++;
    
    if (numParts < 8) {
        Serial.println("!! ERR: Invalid servo config format");
        return;
    }
    
    // Split
    String parts[35]; // Cmd + 7 fixed + up to 8*3 point values
    int count = 0;
    int lastPos = 0;
    for (int i = 0; i < 35; i++) {
        int nextPos = cmd.indexOf(':', lastPos);
        if (nextPos == -1) {
            parts[i] = cmd.substring(lastPos);
            count++;
            break;
        }
        parts[i] = cmd.substring(lastPos, nextPos);
        count++;
        lastPos = nextPos + 1;
    }

    int pin = parts[1].toInt();
    int idx = findServoIdx(pin);
    if (idx == -1) {
        if (servoCount >= MAX_SERVOS) {
            Serial.println("!! ERR: Max servos reached");
            return;
        }
        idx = servoCount++;
        servoConfigs[idx].currentPos = 90.0f;
    }

    ServoConfig &c = servoConfigs[idx];
    c.pin = pin;
    c.frequency = parts[2].toInt();
    c.minPulse = parts[3].toInt();
    c.maxPulse = parts[4].toInt();
    c.speed = parts[5].toInt();
    c.sourceChannel = parts[6].toInt();
    c.numPoints = parts[7].toInt();
    if (c.numPoints > 8) c.numPoints = 8;
    
    for (int j = 0; j < c.numPoints; j++) {
        int baseIdx = 8 + j*3;
        if (baseIdx + 2 < count) {
            c.points[j].inValue = parts[baseIdx].toInt();
            c.points[j].outAngle = parts[baseIdx + 1].toInt();
            c.points[j].proportional = parts[baseIdx + 2].toInt() == 1;
        }
    }

    persistServo(idx);
    applyPinRuntime(pin, 2, 0); 
    Serial.printf(">> OK: Servo config saved for pin %d\n", pin);
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
    cmd.trim();
    if (cmd.length() == 0) return;
    Serial.println("> Komenda: " + cmd);

    if (cmd == "HARD RESET") {
        Serial.println("!!! CZYSZCZENIE PAMIECI I REBOOT !!!");
        Serial1.end();
        Serial2.end();
        Serial3.end();
        prefs.begin("sys_config", false);
        prefs.clear();
        prefs.putBool("u1_en", false);
        prefs.putBool("u2_en", false);
        prefs.putBool("u3_en", false);
        prefs.end();
        Serial.flush();
        ESP.restart();
    }
    else if (cmd == "REBOOT") {
        Serial.println(">> Restartowanie urządzenia...");
        Serial.flush();
        delay(100);
        ESP.restart();
    }
    else if (cmd == "STATUS") {
        Serial.printf("U1:%s (%s) RX%d TX%d @%ld | U2:%s (%s) RX%d TX%d @%ld | U3:%s (%s) RX%d TX%d @%ld\n",
                      u1_enabled?"EN":"DI", u1_type.c_str(), u1_rx, u1_tx, u1_baud,
                      u2_enabled?"EN":"DI", u2_type.c_str(), u2_rx, u2_tx, u2_baud,
                      u3_enabled?"EN":"DI", u3_type.c_str(), u3_rx, u3_tx, u3_baud);
    }
    else if (cmd == "PIN_TABLE") {
        Serial.printf("UART_CONF,1,%s,%d,%d,%ld,%s\n", u1_enabled?"ENABLED":"DISABLED", u1_rx, u1_tx, u1_baud, u1_type.c_str());
        Serial.printf("UART_CONF,2,%s,%d,%d,%ld,%s\n", u2_enabled?"ENABLED":"DISABLED", u2_rx, u2_tx, u2_baud, u2_type.c_str());
        Serial.printf("UART_CONF,3,%s,%d,%d,%ld,%s\n", u3_enabled?"ENABLED":"DISABLED", u3_rx, u3_tx, u3_baud, u3_type.c_str());
        reportAllPins();
    }
    else if (cmd == "FULL_CONFIG") {
        Serial.println("DEVICE,esp32c3,1.0.0");
        Serial.printf("UART_CONF,1,%s,%d,%d,%ld,%s\n", u1_enabled?"ENABLED":"DISABLED", u1_rx, u1_tx, u1_baud, u1_type.c_str());
        Serial.printf("UART_CONF,2,%s,%d,%d,%ld,%s\n", u2_enabled?"ENABLED":"DISABLED", u2_rx, u2_tx, u2_baud, u2_type.c_str());
        Serial.printf("UART_CONF,3,%s,%d,%d,%ld,%s\n", u3_enabled?"ENABLED":"DISABLED", u3_rx, u3_tx, u3_baud, u3_type.c_str());
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
        Serial.print("GPS_SETTINGS,");
        Serial.print(gps_protocol); Serial.print(",");
        Serial.print(gps_auto_config ? 1 : 0); Serial.print(",");
        Serial.print(gps_galileo ? 1 : 0); Serial.print(",");
        Serial.print(gps_home_once ? 1 : 0); Serial.print(",");
        Serial.print(gps_ground_assist); Serial.print(",");
        Serial.println(gps_mag_declination);
        reportServoConfigs();
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
    else if (cmd.startsWith("SET_UART1_RX:")) { savePin("u1_rx", cmd.substring(13).toInt(), u1_rx); restartUART1(); }
    else if (cmd.startsWith("SET_UART1_TX:")) { savePin("u1_tx", cmd.substring(13).toInt(), u1_tx); restartUART1(); }
    else if (cmd.startsWith("SET_UART1_BAUD:")) { saveBaud("u1_baud", cmd.substring(15).toInt(), u1_baud); restartUART1(); }
    else if (cmd.startsWith("SET_UART1_TYPE:")) { saveType("u1_type", cmd.substring(15), u1_type); }
    else if (cmd.startsWith("SET_UART2_RX:")) { savePin("u2_rx", cmd.substring(13).toInt(), u2_rx); restartUART2(); }
    else if (cmd.startsWith("SET_UART2_TX:")) { savePin("u2_tx", cmd.substring(13).toInt(), u2_tx); restartUART2(); }
    else if (cmd.startsWith("SET_UART2_BAUD:")) { saveBaud("u2_baud", cmd.substring(15).toInt(), u2_baud); restartUART2(); }
    else if (cmd.startsWith("SET_UART2_TYPE:")) { saveType("u2_type", cmd.substring(15), u2_type); }
    else if (cmd.startsWith("SET_UART3_RX:")) { savePin("u3_rx", cmd.substring(13).toInt(), u3_rx); restartUART3(); }
    else if (cmd.startsWith("SET_UART3_TX:")) { savePin("u3_tx", cmd.substring(13).toInt(), u3_tx); restartUART3(); }
    else if (cmd.startsWith("SET_UART3_BAUD:")) { saveBaud("u3_baud", cmd.substring(15).toInt(), u3_baud); restartUART3(); }
    else if (cmd.startsWith("SET_UART3_TYPE:")) { saveType("u3_type", cmd.substring(15), u3_type); }
    else if (cmd.startsWith("SET_CHMAP:")) { saveType("rx_ch_map", cmd.substring(10), rx_ch_map); }
    else if (cmd.startsWith("SET_RC_MIN:")) { saveInt("rc_min", cmd.substring(11).toInt(), rc_min); }
    else if (cmd.startsWith("SET_RC_MID:")) { saveInt("rc_mid", cmd.substring(11).toInt(), rc_mid); }
    else if (cmd.startsWith("SET_RC_MAX:")) { saveInt("rc_max", cmd.substring(11).toInt(), rc_max); }
    else if (cmd.startsWith("SET_DB_RC:")) { saveInt("db_rc", cmd.substring(10).toInt(), db_rc); }
    else if (cmd.startsWith("SET_DB_YAW:")) { saveInt("db_yaw", cmd.substring(11).toInt(), db_yaw); }
    else if (cmd.startsWith("SET_DB_THR3D:")) { saveInt("db_thr3d", cmd.substring(13).toInt(), db_thr3d); }
    else if (cmd.startsWith("SET_RC_SMOOTH:")) { saveEnabled("rc_smooth", cmd.substring(14).toInt() == 1, rc_smooth); }
    else if (cmd.startsWith("SET_RC_SMOOTH_COEFF:")) { saveInt("rc_smooth_coeff", cmd.substring(20).toInt(), rc_smooth_coeff); }
    else if (cmd.startsWith("SET_STEER_CH:")) { saveInt("steer_ch", cmd.substring(13).toInt(), steering_ch); }
    else if (cmd.startsWith("SET_THR_CH:")) { saveInt("thr_ch", cmd.substring(11).toInt(), throttle_ch); }
    else if (cmd.startsWith("SET_STEER_REV:")) { saveEnabled("steer_rev", cmd.substring(14).toInt() == 1, steering_rev); }
    else if (cmd.startsWith("SET_THR_REV:")) { saveEnabled("thr_rev", cmd.substring(12).toInt() == 1, throttle_rev); }
    else if (cmd.startsWith("SET_CONTROL_MODE:")) { saveType("ctrl_mode", cmd.substring(17), control_mode); }
    else if (cmd.startsWith("SET_DIR_CH:")) { saveInt("dir_ch", cmd.substring(11).toInt(), direction_ch); }
    else if (cmd.startsWith("SET_SPEED_CH:")) { saveInt("spd_ch", cmd.substring(13).toInt(), speed_ch); }
    else if (cmd.startsWith("SET_DIR_POL:")) { saveEnabled("dir_pol", cmd.substring(12).toInt() == 1, dir_pressed_is_reverse); }
    else if (cmd.startsWith("SET_GPS_PROTOCOL:")) { saveType("gps_proto", cmd.substring(17), gps_protocol); }
    else if (cmd.startsWith("SET_GPS_AUTO_CONFIG:")) { saveEnabled("gps_auto", cmd.substring(20).toInt() == 1, gps_auto_config); }
    else if (cmd.startsWith("SET_GPS_GALILEO:")) { saveEnabled("gps_galileo", cmd.substring(16).toInt() == 1, gps_galileo); }
    else if (cmd.startsWith("SET_GPS_HOME_ONCE:")) { saveEnabled("gps_home_once", cmd.substring(18).toInt() == 1, gps_home_once); }
    else if (cmd.startsWith("SET_GPS_GROUND_ASSIST:")) { saveType("gps_assist", cmd.substring(22), gps_ground_assist); }
    else if (cmd.startsWith("SET_GPS_MAG_DECLINATION:")) { saveFloat("gps_mag", cmd.substring(24).toFloat(), gps_mag_declination); }
    else if (cmd == "DISABLE_UART1") {
        saveEnabled("u1_en", false, u1_enabled);
        u1_rx = -1; u1_tx = -1;
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
    else if (cmd == "ENABLE_RECEIVER_MODE") {
        int rx = -1, tx = -1;
        if (u1_type == "RECEIVER" && u1_enabled) { rx = u1_rx; tx = u1_tx; Serial1.end(); }
        else if (u2_type == "RECEIVER" && u2_enabled) { rx = u2_rx; tx = u2_tx; Serial2.end(); }
        else if (u3_type == "RECEIVER" && u3_enabled) { rx = u3_rx; tx = u3_tx; Serial3.end(); }
        if (rx == -1) {
             Serial.println(">> INFO: Nie znaleziono UART typu RECEIVER, uzywam domyslnego UART1");
             if (u1_enabled) Serial1.end();
             rx = u1_rx; tx = u1_tx;
        }
        crsfSerial.begin(420000, SERIAL_8N1, rx, tx);
        crsf.begin(crsfSerial);
        receiverMode = true;
        Serial.printf(">> Receiver Mode ENABLED (ELRS 420k @ RX:%d/TX:%d)\n", rx, tx);
    }
    else if (cmd == "DISABLE_RECEIVER_MODE") {
        receiverMode = false;
        crsfSerial.end();
        if (u1_enabled) Serial1.begin(u1_baud, SERIAL_8N1, u1_rx, u1_tx);
        if (u2_enabled) Serial2.begin(u2_baud, SWSERIAL_8N1, u2_rx, u2_tx);
        if (u3_enabled) Serial3.begin(u3_baud, SWSERIAL_8N1, u3_rx, u3_tx);
        Serial.println(">> Receiver Mode DISABLED");
    }
    else if (cmd == "ENABLE_GPS_MODE") {
        if (u1_type == "GPS" && u1_enabled) { 
            Serial1.end();
            Serial1.begin(u1_baud, SERIAL_8N1, u1_rx, u1_tx);
            Serial.printf(">> GPS Mode ENABLED on UART1 (HW) @ %ld\n", u1_baud);
        }
        else if (u2_type == "GPS" && u2_enabled) {
            Serial2.begin(u2_baud, SWSERIAL_8N1, u2_rx, u2_tx);
            Serial.printf(">> GPS Mode ENABLED on UART2 (SW) @ %ld\n", u2_baud);
        }
        else if (u3_type == "GPS" && u3_enabled) {
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
        if (!u2_enabled) {
            Serial2.end();
        }
        Serial.println(">> GPS Mode DISABLED");
    }
    else if (cmd.startsWith("SET_PIN_MODE:")) {
        // Implementacja w pliku serial_comm.ino (zaktualizowana)
        setPinModeCommand(cmd);
    }
    else if (cmd.startsWith("SET_SERVO_CFG:")) {
        setServoConfigCommand(cmd);
    }
    else if (cmd == "SERVO_TABLE") {
        reportServoConfigs();
    }
    else if (cmd.startsWith("SERVO_MOVE:")) {
        // Format: SERVO_MOVE:pin:angle
        int c1 = cmd.indexOf(':', 11);
        int pin = cmd.substring(11, c1).toInt();
        int angle = cmd.substring(c1 + 1).toInt();
        if (angle < 0) angle = 0;
        if (angle > 180) angle = 180;
        
        // Find or create servo config for this pin
        int idx = findServoIdx(pin);
        if (idx == -1) {
            if (servoCount >= MAX_SERVOS) {
                Serial.println("!! ERR: Max servos reached");
                return;
            }
            idx = servoCount++;
            servoConfigs[idx].pin = pin;
            servoConfigs[idx].frequency = 50;
            servoConfigs[idx].minPulse = 500;
            servoConfigs[idx].maxPulse = 2500;
            servoConfigs[idx].speed = 0;
            servoConfigs[idx].sourceChannel = 0;
            servoConfigs[idx].numPoints = 0;
        }
        
        // Directly set position
        servoConfigs[idx].currentPos = (float)angle;
        
        // Write pulse immediately
        float us = servoConfigs[idx].minPulse + ((float)angle / 180.0f) * (servoConfigs[idx].maxPulse - servoConfigs[idx].minPulse);
        uint32_t periodUs = 1000000 / servoConfigs[idx].frequency;
        uint32_t duty = (uint32_t)((us * 65535ULL) / periodUs);
        ledcWrite(pin, duty);
        
        Serial.printf(">> SERVO_POS:%d:%d\n", pin, angle);
    }
}
