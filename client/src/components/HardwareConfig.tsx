import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, Cpu, HardDrive, Wifi } from "lucide-react";
import { motion } from "framer-motion";

interface ModemConfig {
  enabled: boolean;
  deviceType: string;
  devicePath: string;
  baudRate: number;
  autoDetect: boolean;
}

const MODEM_DEVICES = [
  {
    id: "usrobotics-usr5637",
    name: "USRobotics USR5637",
    description: "USB Dial-Up Modem",
    defaultPath: "/dev/ttyUSB0",
    defaultBaud: 115200,
    icon: Phone,
  },
  {
    id: "grandstream-ht802",
    name: "Grandstream HT802",
    description: "VoIP ATA Gateway",
    defaultPath: "/dev/ttyACM0",
    defaultBaud: 115200,
    icon: Wifi,
  },
  {
    id: "generic-serial",
    name: "Generic Serial Modem",
    description: "Standard AT Command Modem",
    defaultPath: "/dev/ttyUSB0",
    defaultBaud: 115200,
    icon: HardDrive,
  },
  {
    id: "custom",
    name: "Custom Configuration",
    description: "Manual device setup",
    defaultPath: "/dev/ttyUSB0",
    defaultBaud: 115200,
    icon: Cpu,
  },
];

export function HardwareConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config } = useQuery<ModemConfig>({
    queryKey: ["/api/hardware/modem"],
    initialData: {
      enabled: false,
      deviceType: "usrobotics-usr5637",
      devicePath: "/dev/ttyUSB0",
      baudRate: 115200,
      autoDetect: true,
    },
  });

  const [localConfig, setLocalConfig] = useState(config);

  const updateConfig = useMutation({
    mutationFn: async (newConfig: Partial<ModemConfig>) => {
      const res = await fetch("/api/hardware/modem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      if (!res.ok) throw new Error("Failed to update configuration");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hardware/modem"] });
      toast({
        title: "Hardware configured",
        description: "Modem settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update hardware configuration.",
        variant: "destructive",
      });
    },
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/hardware/modem/test", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Connection test failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connection successful",
        description: data.message || "Modem is responding correctly.",
      });
    },
    onError: () => {
      toast({
        title: "Connection failed",
        description: "Could not communicate with the modem. Check your settings.",
        variant: "destructive",
      });
    },
  });

  const handleDeviceChange = (deviceId: string) => {
    const device = MODEM_DEVICES.find(d => d.id === deviceId);
    if (device) {
      setLocalConfig({
        ...localConfig,
        deviceType: deviceId,
        devicePath: device.defaultPath,
        baudRate: device.defaultBaud,
      });
    }
  };

  const handleSave = () => {
    updateConfig.mutate(localConfig);
  };

  const selectedDevice = MODEM_DEVICES.find(d => d.id === localConfig.deviceType) || MODEM_DEVICES[0];
  const DeviceIcon = selectedDevice.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Hardware Configuration
        </CardTitle>
        <CardDescription>
          Configure your telephony hardware for spam call blocking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Modem */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="modem-enabled">Enable Modem</Label>
            <p className="text-sm text-muted-foreground">
              Activate hardware spam call detection
            </p>
          </div>
          <Switch
            id="modem-enabled"
            checked={localConfig.enabled}
            onCheckedChange={(checked) => 
              setLocalConfig({ ...localConfig, enabled: checked })
            }
          />
        </div>

        {localConfig.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {/* Device Selection */}
            <div className="space-y-2">
              <Label htmlFor="device-type">Device Type</Label>
              <Select
                value={localConfig.deviceType}
                onValueChange={handleDeviceChange}
              >
                <SelectTrigger id="device-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEM_DEVICES.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      <div className="flex items-center gap-2">
                        <device.icon className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{device.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {device.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Device Info */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <DeviceIcon className="h-8 w-8 text-primary mt-1" />
                <div className="flex-1">
                  <h4 className="font-semibold">{selectedDevice.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedDevice.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Auto-detect */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-detect">Auto-detect Device</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically find connected modem
                </p>
              </div>
              <Switch
                id="auto-detect"
                checked={localConfig.autoDetect}
                onCheckedChange={(checked) =>
                  setLocalConfig({ ...localConfig, autoDetect: checked })
                }
              />
            </div>

            {!localConfig.autoDetect && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {/* Device Path */}
                <div className="space-y-2">
                  <Label htmlFor="device-path">Device Path</Label>
                  <Input
                    id="device-path"
                    value={localConfig.devicePath}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, devicePath: e.target.value })
                    }
                    placeholder="/dev/ttyUSB0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Common paths: /dev/ttyUSB0, /dev/ttyACM0, /dev/ttyS0
                  </p>
                </div>

                {/* Baud Rate */}
                <div className="space-y-2">
                  <Label htmlFor="baud-rate">Baud Rate</Label>
                  <Select
                    value={localConfig.baudRate.toString()}
                    onValueChange={(value) =>
                      setLocalConfig({ ...localConfig, baudRate: parseInt(value) })
                    }
                  >
                    <SelectTrigger id="baud-rate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9600">9600</SelectItem>
                      <SelectItem value="19200">19200</SelectItem>
                      <SelectItem value="38400">38400</SelectItem>
                      <SelectItem value="57600">57600</SelectItem>
                      <SelectItem value="115200">115200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSave}
                disabled={updateConfig.isPending}
              >
                {updateConfig.isPending ? "Saving..." : "Save Configuration"}
              </Button>
              <Button
                variant="outline"
                onClick={() => testConnection.mutate()}
                disabled={testConnection.isPending}
              >
                {testConnection.isPending ? "Testing..." : "Test Connection"}
              </Button>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
