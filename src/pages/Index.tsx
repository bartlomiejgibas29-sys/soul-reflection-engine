import { useState, useEffect } from "react";
import TopHeader from "@/components/TopHeader";
import StatusBar from "@/components/StatusBar";
import Sidebar from "@/components/Sidebar";
import PortsPage from "@/components/PortsPage";
import LandingPage from "@/components/LandingPage";
import SetupPage from "@/components/SetupPage";
import ReceiverPage from "@/components/ReceiverPage";
import GpsPage from "@/components/GpsPage";
import Console from "@/components/Console";
import { useSerial } from "@/hooks/useSerial";

const Index = () => {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem("lastTab") || "Setup";
    } catch (e) {
      return "Setup";
    }
  });
  const { connected, deviceInfo, lastSent, uartConfigs, receiverData, receiverSettings, gpsData, gpsSettings, logs, connect, disconnect, send, reboot } = useSerial();

  useEffect(() => {
    if (!connected) {
      setActiveTab("Setup"); 
    }
  }, [connected]);

  // Handle Save & Reboot from children
  const handleReboot = () => {
    reboot();
    // Toast notification would be nice here
  };

  useEffect(() => {
    try {
      localStorage.setItem("lastTab", activeTab);
    } catch (e) {}
  }, [activeTab]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopHeader
        connected={connected}
        deviceInfo={deviceInfo}
        onConnect={connect}
        onDisconnect={disconnect}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {connected && (
          <Sidebar 
            activeTab={activeTab} 
            onTabChange={setActiveTab} 
          />
        )}
        
        <main className={`flex-1 flex flex-col overflow-hidden bg-background ${connected ? 'p-6' : 'p-0'}`}>
          {!connected ? (
            <LandingPage />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <h1 className="text-2xl font-light text-foreground mb-4 shrink-0">{activeTab}</h1>
              
              <div className="flex-1 overflow-y-auto min-h-0">
                {activeTab === "Setup" && <SetupPage uartConfigs={uartConfigs} onSend={send} onReboot={reboot} gpsData={gpsData} />}
                
                {activeTab === "Ports" && <PortsPage uartConfigs={uartConfigs} connected={connected} onSend={send} />}
                
                {activeTab === "Receiver" && <ReceiverPage data={receiverData} settings={receiverSettings} onSend={send} />}

                {activeTab === "GPS" && <GpsPage data={gpsData} settings={gpsSettings} onSend={send} />}

                {activeTab === "CLI" && (
                  <div className="h-full pb-2">
                    <Console logs={logs} />
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <StatusBar lastMessage={lastSent} />
    </div>
  );
};

export default Index;
