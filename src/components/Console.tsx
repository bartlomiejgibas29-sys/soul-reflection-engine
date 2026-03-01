import { useEffect, useRef } from "react";

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
    <div className="flex flex-col h-full rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-2.5 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-semibold text-sm text-foreground">Serial Console</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{logs.length} lines</span>
      </div>
      {/* Terminal body */}
      <textarea
        className="flex-1 bg-[hsl(0,0%,8%)] text-[hsl(120,60%,60%)] resize-none focus:outline-none w-full h-full text-xs font-mono p-3 leading-relaxed selection:bg-primary/30"
        readOnly
        value={logs.join("")}
        ref={scrollRef}
        spellCheck={false}
      />
    </div>
  );
};

export default Console;
