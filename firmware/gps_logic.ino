#include "config.h"

void sendGpsCommand(const uint8_t* cmd, size_t len) {
    if (u1_type == "GPS" && u1_enabled) Serial1.write(cmd, len);
    else if (u2_type == "GPS" && u2_enabled) Serial2.write(cmd, len);
    else if (u3_type == "GPS" && u3_enabled) Serial3.write(cmd, len);
}

void configureGps() {
    if (gps_protocol == "UBLOX" && gps_auto_config) {
        Serial.println(">> Config: UBLOX 10Hz + Galileo/EGNOS");
        // UBX-CFG-RATE (100ms = 10Hz)
        uint8_t cfgRate[] = {0xB5, 0x62, 0x06, 0x08, 0x06, 0x00, 0x64, 0x00, 0x01, 0x00, 0x01, 0x00, 0x7A, 0x12};
        sendGpsCommand(cfgRate, sizeof(cfgRate));
        
        // UBX-CFG-NAV5 (Airborne < 4g)
        uint8_t cfgNav5[] = {0xB5, 0x62, 0x06, 0x24, 0x24, 0x00, 0xFF, 0xFF, 0x06, 0x03, 0x00, 0x00, 0x00, 0x00, 0x10, 0x27, 0x00, 0x00, 0x05, 0x00, 0xFA, 0x00, 0xFA, 0x00, 0x64, 0x00, 0x2C, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0xDC};
        sendGpsCommand(cfgNav5, sizeof(cfgNav5));
        
        if (gps_galileo) {
            // UBX-CFG-GNSS (Włączenie Galileo)
            uint8_t cfgGalileo[] = {0xB5, 0x62, 0x06, 0x3E, 0x2C, 0x00, 0x00, 0x00, 0x20, 0x05, 0x00, 0x08, 0x10, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x01, 0x03, 0x00, 0x01, 0x00, 0x01, 0x01, 0x02, 0x04, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x05, 0x00, 0x03, 0x00, 0x01, 0x00, 0x01, 0x01, 0x06, 0x08, 0x0E, 0x00, 0x01, 0x00, 0x01, 0x01, 0xD0, 0x3D};
            sendGpsCommand(cfgGalileo, sizeof(cfgGalileo));
        }
    } else if (gps_protocol == "MSP") {
        Serial.println(">> Config: MSP GPS Mode initialized");
    } else {
        Serial.println(">> Config: NMEA Generic Mode");
    }
}

void handleGpsLoop() {
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

        if (millis() - lastGpsUpdate > 200) { // Wysyłaj co 200ms (5Hz)
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
