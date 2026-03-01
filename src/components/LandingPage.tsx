import { 
  Rocket, Github, ExternalLink, Cpu, FileText, Download, Instagram 
} from "lucide-react";

const LandingPage = () => {
  return (
    <div className="flex flex-col min-h-full bg-background text-foreground">
      {/* Hero / Welcome Banner */}
      <div className="bg-background flex flex-col items-center justify-center pt-12 pb-8 border-b border-border/10">
        <div className="flex items-center gap-4 mb-4">
          <Rocket className="text-yellow-500 w-16 h-16 animate-pulse" />
          <h1 className="text-6xl font-black italic tracking-tighter text-foreground">
            BETA<span className="text-yellow-500">DRIVE</span>
          </h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl text-center">
          Welcome to <span className="font-semibold text-foreground">BetaDrive Configurator</span>, a powerful utility designed to simplify updating, configuring, and tuning your drive controller.
        </p>
      </div>

      {/* Main Content Area mimicking Betaflight layout */}
      <div className="flex-1 bg-accent/5 p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          
          {/* Hardware Section */}
          <div className="bg-card border border-border rounded-sm shadow-sm p-6">
            <h2 className="text-xl font-bold text-yellow-500 mb-4 flex items-center gap-2">
              <Cpu size={20} /> Hardware Support
            </h2>
            <div className="space-y-4 text-sm text-card-foreground/80">
              <p>
                The application supports all hardware that runs BetaDrive. Check the flash tab for a full list of supported drive controllers.
              </p>
              
              <div className="space-y-2 pt-2">
                <a href="#" className="flex items-center gap-2 text-primary hover:text-yellow-500 transition-colors">
                  <Download size={14} /> Download Blackbox Log Viewer
                </a>
                <a href="#" className="flex items-center gap-2 text-primary hover:text-yellow-500 transition-colors">
                  <ExternalLink size={14} /> Download STM USB VCP Drivers
                </a>
                <a href="#" className="flex items-center gap-2 text-primary hover:text-yellow-500 transition-colors">
                  <ExternalLink size={14} /> Download CP210x Drivers
                </a>
                <a href="#" className="flex items-center gap-2 text-primary hover:text-yellow-500 transition-colors">
                  <ExternalLink size={14} /> Download Zadig (Windows driver installation)
                </a>
              </div>

              <a
                href="https://www.instagram.com/betadrive_official?igsh=MW5tMjc4ZW5yYjR0OQ=="
                target="_blank"
                rel="noreferrer"
                className="pt-4 flex items-center gap-3 p-3 rounded border transition-colors bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-amber-500/10 border-pink-500/30 hover:from-pink-500/20 hover:via-purple-500/20 hover:to-amber-500/20"
              >
                <Instagram className="text-pink-500" />
                <div>
                  <div className="font-semibold text-pink-500">Join our Community on Instagram</div>
                  <div className="text-xs">Talk about BetaDrive, ask configuration questions, or hang out with fellow pilots.</div>
                </div>
              </a>
            </div>
          </div>

          {/* Contributing Section */}
          <div className="bg-card border border-border rounded-sm shadow-sm p-6">
            <h2 className="text-xl font-bold text-yellow-500 mb-4 flex items-center gap-2">
              <Github size={20} /> Contributing
            </h2>
            <div className="space-y-4 text-sm text-card-foreground/80">
              <p>
                You can help make BetaDrive even better! Here are some ways to contribute:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Using your knowledge to create or update content on our <a href="#" className="text-primary hover:underline">Wiki</a>.
                </li>
                <li>
                  <a href="#" className="text-primary hover:underline">Contributing code</a> to the firmware and Configurator - new features, fixes, improvements.
                </li>
                <li>
                  Testing new features and fixes and providing feedback.
                </li>
                <li>
                  Helping other users solve problems in our issue tracker and online forums.
                </li>
                <li>
                  Translating BetaDrive Configurator into new languages.
                </li>
              </ul>

              <div className="mt-6 border-t border-border pt-4">
                <h3 className="font-semibold mb-2 text-foreground">Open Source / Donation Notice</h3>
                <p className="mb-4">
                  BetaDrive is open source and free of charge. If you found it useful, please consider supporting its development.
                </p>
                <button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-6 rounded-full transition-colors flex items-center gap-2 mx-auto w-fit shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0">
                  <span className="text-lg">♥</span> Donate
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
      
      <div className="bg-black/90 text-white/60 text-[10px] py-2 px-4 text-center border-t border-white/10">
        Language: <span className="text-white font-bold">English</span>
      </div>
    </div>
  );
};

export default LandingPage;
