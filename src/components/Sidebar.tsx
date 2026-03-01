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
    <nav className="w-44 min-h-full bg-sidebar border-r border-sidebar-border flex flex-col justify-between pb-4">
      <div className="flex flex-col">
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
      </div>
    </nav>
  );
};

export default Sidebar;
