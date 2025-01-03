import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Laptop, Smartphone, Server, Activity, Clock, Signal, Wifi } from "lucide-react";

const deviceSchema = z.object({
  name: z.string().min(1, "Device name is required"),
  ipAddress: z.string().min(1, "IP address is required"),
  port: z.string().transform((val) => parseInt(val, 10)),
  deviceType: z.enum(["raspberry_pi", "android", "custom"]),
});

type DeviceFormData = z.infer<typeof deviceSchema>;

function formatUptime(lastHeartbeat: string | null): string {
  if (!lastHeartbeat) return "N/A";
  const last = new Date(lastHeartbeat);
  const now = new Date();
  const diff = Math.floor((now.getTime() - last.getTime()) / 1000); // seconds

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function DeviceConfigPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);

  const { data: devices } = useQuery({
    queryKey: ["/api/devices"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const addDevice = useMutation({
    mutationFn: async (data: DeviceFormData) => {
      const response = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setIsAdding(false);
      toast({
        title: "Device added successfully",
        description: "The device has been configured and can now receive calls.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add device",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
    defaultValues: {
      name: "",
      ipAddress: "",
      port: "5000",
      deviceType: "raspberry_pi",
    },
  });

  const onSubmit = (data: DeviceFormData) => {
    addDevice.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Connected Devices</h2>
        <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
          Add Device
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Add New Device</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Device Name</FormLabel>
                          <FormControl>
                            <Input placeholder="My Raspberry Pi" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ipAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IP Address</FormLabel>
                          <FormControl>
                            <Input placeholder="192.168.1.100" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="port"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Port</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="deviceType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Device Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a device type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="raspberry_pi">Raspberry Pi</SelectItem>
                              <SelectItem value="android">Android Device</SelectItem>
                              <SelectItem value="custom">Custom Device</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAdding(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={addDevice.isPending}>
                        {addDevice.isPending ? "Adding..." : "Add Device"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {devices?.map((device: any) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {device.deviceType === "raspberry_pi" ? (
                      <Server className="h-5 w-5" />
                    ) : device.deviceType === "android" ? (
                      <Smartphone className="h-5 w-5" />
                    ) : (
                      <Laptop className="h-5 w-5" />
                    )}
                    {device.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Signal className="h-4 w-4" />
                        <span>Status:</span>
                        <motion.span
                          animate={{
                            color: device.status === "online" ? "#22c55e" : "#ef4444",
                          }}
                          className="font-medium"
                        >
                          {device.status}
                        </motion.span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Uptime:</span>
                        <motion.span
                          key={device.lastHeartbeat}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="font-medium"
                        >
                          {formatUptime(device.lastHeartbeat)}
                        </motion.span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Wifi className="h-4 w-4" />
                        <span>Address:</span>
                        <span className="font-medium">
                          {device.ipAddress}:{device.port}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Activity className="h-4 w-4" />
                        <span>Last Activity:</span>
                        <span className="font-medium">
                          {device.lastHeartbeat
                            ? new Date(device.lastHeartbeat).toLocaleString()
                            : "Never"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}