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
    <div className="flex flex-col gap-4 h-full overflow-hidden p-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/40 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.10),_transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary/80">BetaDrive</p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">CLI</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Terminal szeregowi i logi komunikacji z firmware. Wszystko w jednym, czytelnym miejscu.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/40 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {logs.join("").split("\n").length - 1} lines
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-3xl border border-border/40 bg-background/40 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-primary" />
            <span className="text-xs font-semibold text-foreground">Serial Console</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] text-muted-foreground font-mono">{logs.join("").split("\n").length - 1} lines</span>
          </div>
        </div>
        <textarea
          className="h-full w-full flex-1 resize-none bg-[hsl(0,0%,6%)] p-4 font-mono text-[11px] leading-relaxed text-[hsl(120,60%,60%)] selection:bg-primary/30 focus:outline-none"
          readOnly
          value={logs.join("")}
          ref={scrollRef}
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default Console;
