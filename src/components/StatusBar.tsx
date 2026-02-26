const StatusBar = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="flex items-center justify-between bg-status-bar px-4 py-1 text-xs border-b border-border">
      <div className="text-foreground">
        {dateStr} @ {timeStr} — <strong>Arming Disabled</strong>
      </div>
      <div className="text-primary cursor-pointer hover:underline">Show Log</div>
    </div>
  );
};

export default StatusBar;
