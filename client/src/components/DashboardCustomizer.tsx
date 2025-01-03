import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface FeatureToggle {
  key: string;
  label: string;
  category: string;
  description?: string;
}

const DEFAULT_FEATURES: FeatureToggle[] = [
  {
    key: "show_risk_score",
    label: "Risk Score Gauge",
    category: "overview",
    description: "Display current risk level gauge"
  },
  {
    key: "show_statistics",
    label: "Statistics Cards",
    category: "overview",
    description: "Show blocking statistics cards"
  },
  {
    key: "show_call_trends",
    label: "Call Trends",
    category: "overview",
    description: "Display recent call trend analytics"
  },
  {
    key: "show_heatmap",
    label: "Geographic Heatmap",
    category: "analytics",
    description: "Show call origin heatmap"
  },
  {
    key: "show_call_stats",
    label: "Detailed Statistics",
    category: "analytics",
    description: "Display detailed call statistics"
  }
];

export function DashboardCustomizer() {
  const { toast } = useToast();
  
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });

      if (!response.ok) {
        throw new Error("Failed to update setting");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings updated",
        description: "Your dashboard preferences have been saved.",
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
        <CardTitle>Dashboard Customization</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {["overview", "analytics"].map((category) => (
            <div key={category} className="space-y-4">
              <h3 className="text-lg font-semibold capitalize">{category}</h3>
              <div className="space-y-4">
                {DEFAULT_FEATURES.filter(feature => feature.category === category).map((feature) => (
                  <div
                    key={feature.key}
                    className="flex items-center justify-between space-x-2"
                  >
                    <div className="space-y-0.5">
                      <Label htmlFor={feature.key}>{feature.label}</Label>
                      {feature.description && (
                        <p className="text-sm text-muted-foreground">
                          {feature.description}
                        </p>
                      )}
                    </div>
                    <Switch
                      id={feature.key}
                      checked={settings?.[feature.key]?.isEnabled ?? true}
                      onCheckedChange={(checked) =>
                        updateSetting.mutate({ key: feature.key, enabled: checked })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
