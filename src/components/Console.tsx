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
    <div className="flex flex-col h-full bg-zinc-950 text-green-500 font-mono text-xs p-2 rounded border border-border">
      <div className="flex justify-between items-center border-b border-border pb-1 mb-1">
        <span className="font-bold">Serial Console</span>
        <span className="text-[10px] text-muted-foreground">{logs.length} lines</span>
      </div>
      <textarea
        className="flex-1 bg-transparent resize-none focus:outline-none w-full h-full text-xs font-mono"
        readOnly
        value={logs.join("")}
        ref={scrollRef}
      />
    </div>
  );
};

export default Console;
