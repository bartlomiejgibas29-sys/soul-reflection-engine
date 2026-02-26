import {
  Wrench, Cable, Settings, BatteryCharging, BarChart3,
  Radio, Layers, Cog, Monitor, Tv, HardDrive, Terminal
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { icon: Cable, label: "Ports" },
  { icon: Radio, label: "Receiver" },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  return (
    <nav className="w-44 min-h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      {navItems.map(({ icon: Icon, label }) => {
        const isActive = activeTab === label;
        return (
          <button
            key={label}
            onClick={() => onTabChange(label)}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors border-l-4 ${
              isActive
                ? "border-nav-active bg-nav-active/10 text-primary font-semibold"
                : "border-transparent text-sidebar-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon size={16} className={isActive ? "text-primary" : ""} />
            {label}
          </button>
        );
      })}
    </nav>
  );
};

export default Sidebar;
