import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export interface Setting {
  isEnabled: boolean;
  configuration: Record<string, any>;
}

export interface SettingsProps {
  settings: Record<string, Setting>;
  onUpdate?: (key: string, value: boolean) => Promise<void>;
}

export function Settings({ settings, onUpdate }: SettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(settings).map(([key, setting]) => (
          <div key={key} className="flex items-center justify-between">
            <Label htmlFor={key} className="flex flex-col">
              <span className="font-medium">{key}</span>
              {setting.configuration?.description && (
                <span className="text-sm text-gray-500">{setting.configuration.description}</span>
              )}
            </Label>
            <Switch
              id={key}
              checked={setting.isEnabled}
              onCheckedChange={async (checked) => {
                if (onUpdate) {
                  await onUpdate(key, checked);
                }
              }}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}