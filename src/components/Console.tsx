import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";

interface ConsoleProps {
  logs: string[];
}

const Console = ({ logs }: ConsoleProps) => {
  const scrollRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-primary" />
          <span className="text-xs font-semibold text-foreground">Serial Console</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] text-muted-foreground font-mono">{logs.length} lines</span>
        </div>
      </div>
      {/* Terminal body */}
      <textarea
        className="flex-1 bg-[hsl(0,0%,6%)] text-[hsl(120,60%,60%)] resize-none focus:outline-none w-full h-full text-[11px] font-mono p-4 leading-relaxed selection:bg-primary/30"
        readOnly
        value={logs.join("")}
        ref={scrollRef}
        spellCheck={false}
      />
    </div>
  );
};

export default Console;
