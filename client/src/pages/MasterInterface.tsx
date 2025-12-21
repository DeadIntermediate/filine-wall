import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FCCDatabaseView } from "@/components/FCCDatabaseView";
import { DeviceConfigPanel } from "@/components/DeviceConfigPanel";
import { DeviceDiagnosticTool } from "@/components/DeviceDiagnosticTool";
import { SpamReportList } from "@/components/SpamReportList";
import { Statistics } from "@/components/Statistics";
import { CallTrendAnalytics } from "@/components/CallTrendAnalytics";
import { HeatmapView } from "@/components/HeatmapView";
import { RiskScoreGauge } from "@/components/RiskScoreGauge";
import { GitHubWizard } from "@/components/GitHubWizard";
import { CallMonitor } from "@/components/CallMonitor";
import { Settings, type Setting } from "@/components/ui/settings";
import { 
  LayoutDashboard, 
  Smartphone, 
  Database, 
  BarChart3, 
  Settings as SettingsIcon, 
  Wrench,
  ChevronLeft,
  ChevronRight,
  Shield,
  Monitor
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Device {
  deviceId: string;
  name: string;
  status: 'online' | 'offline' | 'configured' | 'disabled';
  type?: string;
  port?: string;
  baudRate?: string;
  ipAddress?: string;
  lastHeartbeat?: string;
  callerIdEnabled?: boolean;
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    if (devices.length > 0 && !selectedDeviceId && devices[0]) {
      setSelectedDeviceId(devices[0].deviceId);
    }
  }, [devices, selectedDeviceId]);

  const menuItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "monitor", label: "Monitor", icon: Monitor },
    { id: "devices", label: "Devices", icon: Smartphone },
    { id: "database", label: "Database", icon: Database },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: SettingsIcon },
    { id: "advanced", label: "Advanced", icon: Wrench },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo/Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
          {!sidebarCollapsed && (
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">FiLine Wall</h1>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="ml-auto"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                  activeTab === item.id
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* System Status */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">System Status</span>
              <div className="flex items-center space-x-2">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    devices.some(d => d.status === 'online') ? "bg-green-500" : "bg-red-500"
                  )}
                />
                <span className="text-sm font-medium">
                  {devices.some(d => d.status === 'online') ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {menuItems.find(item => item.id === activeTab)?.label || "Dashboard"}
          </h2>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {stats && (
                <span>
                  <span className="font-semibold text-gray-900 dark:text-white">{stats.todayBlocks}</span> blocks today
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                <div className="h-full">
                  <RiskScoreGauge score={riskScore?.currentRisk ?? 0} label="System Risk Score" />
                </div>
                <Card className="h-full">
                  <CardContent className="pt-6">
                    <Statistics />
                  </CardContent>
                </Card>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Monitor className="h-5 w-5" />
                      Connected Devices
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {devices.length === 0 ? (
                        <p className="text-sm text-gray-500">No devices detected</p>
                      ) : (
                        devices.map((device) => (
                          <div 
                            key={device.deviceId} 
                            className="p-3 border rounded-lg dark:border-gray-700 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "h-2.5 w-2.5 rounded-full",
                                    device.status === 'online' || device.status === 'configured' ? "bg-green-500" : 
                                    device.status === 'disabled' ? "bg-gray-400" : "bg-red-500"
                                  )}
                                />
                                <span className="font-medium">{device.type || 'Device'}</span>
                              </div>
                              <span className={cn(
                                "text-xs px-2 py-1 rounded-full",
                                device.status === 'online' || device.status === 'configured' ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : 
                                device.status === 'disabled' ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" :
                                "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                              )}>
                                {device.status}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                              {device.port && (
                                <div className="flex justify-between">
                                  <span>Port:</span>
                                  <span className="font-mono">{device.port}</span>
                                </div>
                              )}
                              {device.baudRate && (
                                <div className="flex justify-between">
                                  <span>Baud Rate:</span>
                                  <span className="font-mono">{device.baudRate}</span>
                                </div>
                              )}
                              {device.callerIdEnabled !== undefined && (
                                <div className="flex justify-between">
                                  <span>Caller ID:</span>
                                  <span className={device.callerIdEnabled ? "text-green-600" : "text-gray-500"}>
                                    {device.callerIdEnabled ? 'Enabled' : 'Disabled'}
                                  </span>
                                </div>
                              )}
                              {device.ipAddress && (
                                <div className="flex justify-between">
                                  <span>IP Address:</span>
                                  <span className="font-mono">{device.ipAddress}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Community Spam Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <SpamReportList />
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "monitor" && (
            <div className="space-y-6">
              <CallMonitor />
            </div>
          )}

          {activeTab === "devices" && (
            <div className="space-y-6">
              <DeviceConfigPanel />
              {selectedDeviceId && (
                <DeviceDiagnosticTool deviceId={selectedDeviceId} />
              )}
            </div>
          )}

          {activeTab === "database" && (
            <div className="space-y-6">
              <FCCDatabaseView />
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-6">
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
            </div>
          )}

          {activeTab === "settings" && (
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
          )}

          {activeTab === "advanced" && (
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
          )}
        </div>
      </main>
    </div>
  );
}