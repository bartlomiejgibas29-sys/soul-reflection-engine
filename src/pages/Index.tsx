import { useState } from "react";
import TopHeader from "@/components/TopHeader";
import StatusBar from "@/components/StatusBar";
import Sidebar from "@/components/Sidebar";
import SetupPage from "@/components/SetupPage";

const Index = () => {
  const [activeTab, setActiveTab] = useState("Setup");

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopHeader />
      <StatusBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-y-auto bg-background">
          <SetupPage />
        </main>
      </div>
    </div>
  );
};

export default Index;
