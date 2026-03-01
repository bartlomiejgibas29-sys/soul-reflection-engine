import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SetupPageProps {
  onStatus: () => void;
  onResetSettings: () => void;
}

const SetupPage = ({ onStatus, onResetSettings }: SetupPageProps) => {
  const handleReset = () => {
    try {
      onResetSettings();
      localStorage.setItem("shouldAutoConnect", "true");
    } catch {}
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };
  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        {/* Status Button */}
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
          <Button 
            className="w-48 bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
            onClick={onStatus}
          >
            Status
          </Button>
          <p className="text-sm text-muted-foreground">
            Check system status and sensor health.
          </p>
        </div>

        {/* Reset Settings */}
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-48 bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                Reset Settings
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to reset controller settings?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will restore default settings (HARD RESET). This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Reset now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="text-sm text-muted-foreground">
            Restore settings to default.
          </p>
        </div>

        {/* Backup / Restore */}
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
          <div className="flex gap-2 w-48">
            <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold" disabled>
              Backup
            </Button>
            <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold" disabled>
              Restore
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold">Backup</span> your configuration in case of an accident. CLI settings are <span className="text-destructive font-bold">not</span> included.
          </p>
        </div>
      </div>
      
      {/* Placeholder for Info panels similar to the reference image */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div className="md:col-span-2 border rounded-lg bg-card h-64 flex items-center justify-center text-muted-foreground bg-muted/10">
            <div className="text-center">
                <p>3D Model Visualization</p>
                <p className="text-xs">(Not implemented yet)</p>
            </div>
        </div>
        <div className="space-y-4">
            <div className="border rounded-lg bg-card p-4">
                <h3 className="font-bold border-b pb-2 mb-2 text-sm">Info</h3>
                <div className="text-xs space-y-1">
                    <div className="flex justify-between"><span>Battery voltage:</span><span>0.00 V</span></div>
                    <div className="flex justify-between"><span>RSSI:</span><span>0%</span></div>
                </div>
            </div>
             <div className="border rounded-lg bg-card p-4">
                <h3 className="font-bold border-b pb-2 mb-2 text-sm">GPS</h3>
                <div className="text-xs space-y-1">
                     <div className="flex justify-between"><span>3D Fix:</span><span>False</span></div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
