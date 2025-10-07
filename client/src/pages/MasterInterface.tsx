import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FCCDatabaseView } from "@/components/FCCDatabaseView";
import { DeviceConfigPanel } from "@/components/DeviceConfigPanel";
import { DeviceDiagnosticTool } from "@/components/DeviceDiagnosticTool";
import { SpamReportList } from "@/components/SpamReportList";
import { Statistics } from "@/components/Statistics";
import { CallTrendAnalytics } from "@/components/CallTrendAnalytics";
import { HeatmapView } from "@/components/HeatmapView";
import { RiskScoreGauge } from "@/components/RiskScoreGauge";
import { GitHubWizard } from "@/components/GitHubWizard";
import { Settings, type Setting } from "@/components/ui/settings";

interface Device {
  deviceId: string;
  name: string;
  status: 'online' | 'offline';
  ipAddress: string;
  lastHeartbeat?: string;
}

interface RiskScoreData {
  currentRisk: number;
  factors: {
    recentBlockRate: number;
    highRiskNumbers: number;
  };
}

interface SystemStats {
  totalBlocked: number;
  blacklistedCount: number;
  todayBlocks: number;
}

export default function MasterInterface() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Fetch connected devices status
  const { data: devices = [] } = useQuery<Device[]>({
    queryKey: ["/api/admin/devices"],
  });

  // Fetch real-time system stats
  const { data: stats } = useQuery<SystemStats>({
    queryKey: ["/api/admin/stats"],
  });

  // Fetch real-time risk score
  const { data: riskScore } = useQuery<RiskScoreData>({
    queryKey: ["/api/admin/risk-score"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch system settings
  const { data: settings = {} } = useQuery<Record<string, Setting>>({
    queryKey: ["/api/admin/settings"],
  });

  // Select first device by default
  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].deviceId);
    }
  }, [devices]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">FiLine Wall Master Control</h1>
        <div className="flex items-center gap-4">
          <RiskScoreGauge score={riskScore?.currentRisk ?? 0} label="System Risk Score" />
          <Button variant="outline">
            System Status: {devices.some(d => d.status === 'online') ? 'Online' : 'Offline'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Statistics />
            <Card>
              <CardHeader>
                <CardTitle>Connected Devices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {devices.map((device) => (
                    <div key={device.deviceId} className="flex items-center justify-between">
                      <span>{device.name}</span>
                      <span className={device.status === 'online' ? 'text-green-500' : 'text-red-500'}>
                        {device.status}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <SpamReportList />
          </div>
        </TabsContent>

        <TabsContent value="devices">
          <div className="space-y-6">
            <DeviceConfigPanel />
            {selectedDeviceId && (
              <DeviceDiagnosticTool deviceId={selectedDeviceId} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="database">
          <div className="space-y-6">
            <FCCDatabaseView />
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Call Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <CallTrendAnalytics />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Geographic Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <HeatmapView />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Settings 
            settings={settings} 
            onUpdate={async (key, value) => {
              await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
              });
            }}
          />
        </TabsContent>

        <TabsContent value="advanced">
          <div className="space-y-6">
            <GitHubWizard />
            <Card>
              <CardHeader>
                <CardTitle>System Maintenance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button variant="outline">Update Database Schema</Button>
                  <Button variant="outline">Export System Logs</Button>
                  <Button variant="outline">Backup Configuration</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}