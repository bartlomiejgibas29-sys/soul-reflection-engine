import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Cpu, RefreshCw, Trash2 } from "lucide-react";
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
  uartConfigs: any[];
  onSend: (cmd: string) => Promise<void> | void;
  onReboot: () => Promise<void> | void;
}

const SetupPage = ({ uartConfigs, onSend, onReboot }: SetupPageProps) => {
  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* System Info Card */}
        <Card className="p-4 space-y-4 bg-card border-border">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Cpu size={16} className="text-primary" />
            <h3 className="font-semibold text-sm">System Actions</h3>
          </div>
          <div className="space-y-2">
            <Button 
              variant="destructive" 
              className="w-full justify-start text-xs h-8"
              onClick={() => onReboot()}
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Save & Reboot
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start text-xs h-8 text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => onSend("HARD RESET")}
            >
              <Trash2 className="mr-2 h-3 w-3" />
              Factory Reset
            </Button>
          </div>
        </Card>

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
