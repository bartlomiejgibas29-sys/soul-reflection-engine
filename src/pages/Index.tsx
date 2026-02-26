import { useState } from "react";
import TopHeader from "@/components/TopHeader";
import StatusBar from "@/components/StatusBar";
import Sidebar from "@/components/Sidebar";
import { useSerial } from "@/hooks/useSerial";

const Index = () => {
  const [activeTab, setActiveTab] = useState("Ports");
  const { connected, deviceInfo, lastSent, connect, disconnect, send } = useSerial();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopHeader
        connected={connected}
        deviceInfo={deviceInfo}
        onConnect={connect}
        onDisconnect={disconnect}
      />
      <StatusBar lastMessage={lastSent} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <h1 className="text-2xl font-light text-foreground mb-4">{activeTab}</h1>
          {!connected && (
            <div className="text-muted-foreground text-sm">
              Kliknij "Connect" aby połączyć się z ESP32-C3.
            </div>
          )}
          {connected && (
            <div className="text-muted-foreground text-sm">
              Połączono z ESP32-C3. Wybierz zakładkę z menu.
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
