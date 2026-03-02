#include "config.h"

void handleReceiverLoop() {
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
}
