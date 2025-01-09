import { useQuery, useMutation } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Settings, Shield, Phone, MapPin, Clock, Users, Activity,
  BrainCircuit, Bell, Database, BarChart
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { DeviceConfigPanel } from "@/components/DeviceConfigPanel";

interface FeatureSettings {
  isEnabled: boolean;
  value?: number | boolean;
}

interface Settings {
  [key: string]: FeatureSettings;
}

interface Feature {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  hasAdvancedSettings?: boolean;
}

interface AdvancedSetting {
  key: string;
  name: string;
  description: string;
  type: 'slider' | 'switch';
  min?: number;
  max?: number;
  step?: number;
}

const features: Feature[] = [
  {
    key: "call_screening",
    name: "Call Screening",
    description: "Screen incoming calls for potential spam",
    icon: <Phone className="h-4 w-4" />,
    hasAdvancedSettings: true
  },
  {
    key: "voice_analysis",
    name: "Voice Analysis",
    description: "Detect robocalls and suspicious voice patterns",
    icon: <Activity className="h-4 w-4" />,
    hasAdvancedSettings: true
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
    hasAdvancedSettings: true
  },
];

const advancedSettings: Record<string, AdvancedSetting[]> = {
  voice_analysis: [
    {
      key: "voice_sensitivity",
      name: "Voice Pattern Sensitivity",
      description: "Adjust the sensitivity of voice pattern detection",
      type: "slider",
      min: 0,
      max: 100,
      step: 5
    },
    {
      key: "min_confidence",
      name: "Minimum AI Confidence",
      description: "Set minimum confidence score for AI predictions",
      type: "slider",
      min: 50,
      max: 95,
      step: 5
    }
  ],
  call_screening: [
    {
      key: "risk_threshold",
      name: "Risk Score Threshold",
      description: "Minimum risk score for automatic call blocking",
      type: "slider",
      min: 0,
      max: 100,
      step: 5
    },
    {
      key: "enable_smart_blocking",
      name: "Smart Blocking",
      description: "Use AI to dynamically adjust blocking rules",
      type: "switch"
    }
  ],
  risk_scoring: [
    {
      key: "scoring_aggression",
      name: "Scoring Aggressiveness",
      description: "Adjust how strictly risk scores are calculated",
      type: "slider",
      min: 1,
      max: 10,
      step: 1
    },
    {
      key: "update_frequency",
      name: "Score Update Frequency",
      description: "How often to update reputation scores (minutes)",
      type: "slider",
      min: 5,
      max: 60,
      step: 5
    }
  ]
};

export function SettingsPanel() {
  const { toast } = useToast();

  const { data: settings = {} as Settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value, type = "toggle" }: { key: string; value: any; type?: string }) => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, type }),
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
                  className="space-y-4"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <div className="flex items-center justify-between space-x-2">
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
                          updateSetting.mutate({ key: feature.key, value: enabled, type: "toggle" })
                        }
                      />
                    </motion.div>
                  </div>

                  {feature.hasAdvancedSettings && settings[feature.key]?.isEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="ml-6 space-y-4 border-l-2 border-primary pl-4"
                    >
                      {advancedSettings[feature.key]?.map((setting) => (
                        <div key={setting.key} className="space-y-2">
                          <Label className="text-sm font-medium">
                            {setting.name}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {setting.description}
                          </p>
                          {setting.type === "slider" ? (
                            <Slider
                              min={setting.min}
                              max={setting.max}
                              step={setting.step}
                              value={[settings[setting.key]?.value as number ?? setting.min ?? 0]}
                              onValueChange={([value]) =>
                                updateSetting.mutate({ 
                                  key: setting.key, 
                                  value, 
                                  type: "slider" 
                                })
                              }
                              className="w-[200px]"
                            />
                          ) : (
                            <Switch
                              checked={settings[setting.key]?.value as boolean ?? false}
                              onCheckedChange={(value) =>
                                updateSetting.mutate({ 
                                  key: setting.key, 
                                  value, 
                                  type: "switch" 
                                })
                              }
                            />
                          )}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </CardContent>
      </Card>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 30 }}
      >
        <DeviceConfigPanel />
      </motion.div>
    </div>
  );
}