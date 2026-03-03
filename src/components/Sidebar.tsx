import { Cable, Radio, Terminal, Settings, Map } from "lucide-react";

const navItems = [
  { icon: Settings, label: "Setup" },
  { icon: Cable, label: "Ports" },
  { icon: Radio, label: "Receiver" },
  { icon: Map, label: "GPS" },
  { icon: Terminal, label: "CLI" },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  return (
    <nav className="w-48 min-h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="flex flex-col py-2">
        {navItems.map(({ icon: Icon, label }) => {
          const isActive = activeTab === label;
          return (
            <button
              key={label}
              onClick={() => onTabChange(label)}
              className={`flex items-center gap-3 px-4 py-3 text-sm text-left transition-all border-l-[3px] ${
                isActive
                  ? "border-primary bg-primary/8 text-primary font-semibold"
                  : "border-transparent text-sidebar-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <Icon size={16} className={isActive ? "text-primary" : "text-muted-foreground"} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Sidebar;
