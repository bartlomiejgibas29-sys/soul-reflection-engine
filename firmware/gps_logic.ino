#include "config.h"

// --- UBX Parser State ---
static uint8_t ubx_buf[512];
static uint16_t ubx_idx = 0;
static uint8_t ubx_state = 0; // 0=sync1, 1=sync2, 2=class, 3=id, 4=len1, 5=len2, 6=payload, 7=ckA, 8=ckB
static uint8_t ubx_class = 0;
static uint8_t ubx_id = 0;
static uint16_t ubx_len = 0;

void processUbxMessage(uint8_t cls, uint8_t id, const uint8_t* payload, uint16_t len) {
    // UBX-NAV-SAT: class=0x01, id=0x35
    if (cls == 0x01 && id == 0x35 && len >= 8) {
        uint8_t numSvs = payload[5];
        uint8_t count = min((uint8_t)MAX_SAT_COUNT, numSvs);
        satCount = count;
        
        for (uint8_t i = 0; i < count; i++) {
            uint16_t offset = 8 + i * 12; // Each satellite block is 12 bytes
            if (offset + 12 > len) break;
            
            satInfos[i].gnssId = payload[offset + 0];
            satInfos[i].svId = payload[offset + 1];
            satInfos[i].cno = payload[offset + 2];
            
            // flags are at offset+8 (4 bytes LE)
            uint32_t flags = payload[offset + 8] | (payload[offset + 9] << 8) | 
                             (payload[offset + 10] << 16) | (payload[offset + 11] << 24);
            satInfos[i].quality = flags & 0x07;        // bits 0-2: signal quality
            satInfos[i].used = (flags & 0x08) != 0;    // bit 3: used in nav solution
        }
    }
}

void feedUbxByte(uint8_t b) {
    switch (ubx_state) {
        case 0: if (b == 0xB5) ubx_state = 1; break;
        case 1: if (b == 0x62) ubx_state = 2; else ubx_state = 0; break;
        case 2: ubx_class = b; ubx_state = 3; break;
        case 3: ubx_id = b; ubx_state = 4; break;
        case 4: ubx_len = b; ubx_state = 5; break;
        case 5: ubx_len |= (b << 8); ubx_idx = 0; ubx_state = (ubx_len > 0) ? 6 : 7; break;
        case 6:
            if (ubx_idx < sizeof(ubx_buf)) ubx_buf[ubx_idx] = b;
            ubx_idx++;
            if (ubx_idx >= ubx_len) ubx_state = 7;
            break;
        case 7: ubx_state = 8; break; // ckA (skip verification for simplicity)
        case 8:
            // ckB - message complete
            if (ubx_len <= sizeof(ubx_buf)) {
                processUbxMessage(ubx_class, ubx_id, ubx_buf, ubx_len);
            }
            ubx_state = 0;
            break;
    }
}

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
        
        // Enable UBX-NAV-SAT message (class 0x01, id 0x35) on current port
        // UBX-CFG-MSG: enable NAV-SAT every 5th fix (1Hz at 5Hz rate)
        uint8_t enableNavSat[] = {0xB5, 0x62, 0x06, 0x01, 0x08, 0x00, 
                                   0x01, 0x35, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 
                                   0x46, 0xAC};
        sendGpsCommand(enableNavSat, sizeof(enableNavSat));
        
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

const char* gnssIdToStr(uint8_t gnssId) {
    switch (gnssId) {
        case 0: return "GPS";
        case 1: return "SBAS";
        case 2: return "Galileo";
        case 3: return "BeiDou";
        case 5: return "IMES";
        case 6: return "QZSS";
        default: return "GLO";
    }
}

const char* qualityToStr(uint8_t q) {
    switch (q) {
        case 0: return "no_signal";
        case 1: return "searching";
        case 2: return "acquired";
        case 3: return "unusable";
        case 4: return "code_locked";
        default: return "fully_locked"; // 5,6,7
    }
}

void handleGpsLoop() {
    if (!gpsMode) return;

    if (gps_protocol == "MSP") {
        // Uproszczony parser MSP GPS
        static uint8_t msp_buf[64];
        static uint8_t msp_idx = 0;
        static uint8_t msp_state = 0;
        static uint8_t msp_len = 0;
        static uint8_t msp_cmd = 0;
        static uint8_t msp_crc = 0;

        auto processMspByte = [&](uint8_t b) {
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
                    if (msp_cmd == 5 && msp_len >= 14) {
                        Serial.println(">> MSP GPS Packet received (RAW_GPS)");
                    }
                }
                msp_state = 0;
            }
        };

        if (u1_type == "GPS" && u1_enabled) while (Serial1.available()) processMspByte(Serial1.read());
        if (u2_type == "GPS" && u2_enabled) while (Serial2.available()) processMspByte(Serial2.read());
        if (u3_type == "GPS" && u3_enabled) while (Serial3.available()) processMspByte(Serial3.read());

    } else {
        // NMEA / UBLOX - feed both TinyGPS and UBX parser
        auto feedByte = [](uint8_t b) {
            gps.encode(b);
            feedUbxByte(b);
        };
        
        if (u1_type == "GPS" && u1_enabled) while (Serial1.available()) feedByte(Serial1.read());
        if (u2_type == "GPS" && u2_enabled) while (Serial2.available()) feedByte(Serial2.read());
        if (u3_type == "GPS" && u3_enabled) while (Serial3.available()) feedByte(Serial3.read());
    }

    if (millis() - lastGpsUpdate > 200) { // 5Hz
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
    
    // Send satellite info at 1Hz
    if (millis() - lastSatUpdate > 1000) {
        lastSatUpdate = millis();
        
        if (satCount > 0) {
            // SAT_INFO,count
            Serial.printf("SAT_INFO,%d\n", satCount);
            for (uint8_t i = 0; i < satCount; i++) {
                // SAT,gnssId,svId,cno,used(0/1),quality_str
                Serial.printf("SAT,%s,%d,%d,%d,%s\n",
                    gnssIdToStr(satInfos[i].gnssId),
                    satInfos[i].svId,
                    satInfos[i].cno,
                    satInfos[i].used ? 1 : 0,
                    qualityToStr(satInfos[i].quality));
            }
        }
    }
}
