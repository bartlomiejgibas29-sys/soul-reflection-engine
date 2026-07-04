export interface ModuleStateShape {
  gps: boolean;
  receiver: boolean;
}

export function applyGpsModuleCommand(current: ModuleStateShape, command: string): ModuleStateShape {
  if (command === "SET_GPS_MODULE:1" || command === "ENABLE_GPS_MODE") {
    return { ...current, gps: true };
  }

  if (command === "SET_GPS_MODULE:0" || command === "DISABLE_GPS_MODE") {
    return { ...current, gps: false };
  }

  return current;
}
