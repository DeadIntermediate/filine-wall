import { useQuery, useMutation } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Shield, Phone, MapPin, Clock, Users, Activity } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Feature {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const features: Feature[] = [
  {
    key: "call_screening",
    name: "Call Screening",
    description: "Screen incoming calls for potential spam",
    icon: <Phone className="h-4 w-4" />,
  },
  {
    key: "voice_analysis",
    name: "Voice Analysis",
    description: "Detect robocalls and suspicious voice patterns",
    icon: <Activity className="h-4 w-4" />,
  },
  {
    key: "geolocation",
    name: "Geolocation Tracking",
    description: "Track and block calls from high-risk locations",
    icon: <MapPin className="h-4 w-4" />,
  },
  {
    key: "time_based",
    name: "Time-Based Rules",
    description: "Block calls during specific hours",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    key: "community",
    name: "Community Protection",
    description: "Share and receive spam reports from the community",
    icon: <Users className="h-4 w-4" />,
  },
  {
    key: "risk_scoring",
    name: "Risk Scoring",
    description: "Real-time risk assessment for incoming calls",
    icon: <Shield className="h-4 w-4" />,
  },
];

export function SettingsPanel() {
  const { toast } = useToast();

  const { data: settings = {} } = useQuery({
    queryKey: ["/api/settings"],
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
      if (!res.ok) throw new Error("Failed to update setting");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-next gap-2">
          <Settings className="h-5 w-5" />
          Feature Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <motion.div 
          className="space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <AnimatePresence>
            {features.map((feature) => (
              <motion.div
                key={feature.key}
                className="flex items-center justify-between space-x-2"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <div className="flex-1 space-y-1">
                  <motion.div 
                    className="flex items-center"
                    whileHover={{ x: 5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <motion.div
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                    >
                      {feature.icon}
                    </motion.div>
                    <Label className="ml-2" htmlFor={feature.key}>
                      {feature.name}
                    </Label>
                  </motion.div>
                  <motion.p 
                    className="text-sm text-muted-foreground"
                    initial={{ opacity: 0.6 }}
                    whileHover={{ opacity: 1 }}
                  >
                    {feature.description}
                  </motion.p>
                </div>
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Switch
                    id={feature.key}
                    checked={settings[feature.key]?.isEnabled ?? true}
                    onCheckedChange={(enabled) =>
                      updateSetting.mutate({ key: feature.key, enabled })
                    }
                  />
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </CardContent>
    </Card>
  );
}