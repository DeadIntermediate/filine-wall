import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Monitor,
  HelpCircle,
  Keyboard,
  Search
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
  const [searchQuery, setSearchQuery] = useState("");

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key) {
        case '1':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setActiveTab("overview");
          }
          break;
        case '2':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setActiveTab("monitor");
          }
          break;
        case '3':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setActiveTab("devices");
          }
          break;
        case '4':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setActiveTab("database");
          }
          break;
        case '5':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setActiveTab("analytics");
          }
          break;
        case '6':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setActiveTab("settings");
          }
          break;
        case 'b':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setSidebarCollapsed(!sidebarCollapsed);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [sidebarCollapsed]);

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
    <TooltipProvider>
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
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
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
                </TooltipTrigger>
                {sidebarCollapsed && (
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>

        {/* System Status */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
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

            {/* Quick Actions */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Quick Actions
              </h4>
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => setActiveTab("monitor")}
                >
                  <Monitor className="h-3 w-3 mr-2" />
                  View Live Calls
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => setActiveTab("analytics")}
                >
                  <BarChart3 className="h-3 w-3 mr-2" />
                  View Analytics
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => setActiveTab("settings")}
                >
                  <SettingsIcon className="h-3 w-3 mr-2" />
                  System Settings
                </Button>
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
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-2">
                  <p className="font-semibold">Keyboard Shortcuts</p>
                  <div className="text-sm space-y-1">
                    <div>Ctrl+1: Overview</div>
                    <div>Ctrl+2: Monitor</div>
                    <div>Ctrl+3: Devices</div>
                    <div>Ctrl+4: Database</div>
                    <div>Ctrl+5: Analytics</div>
                    <div>Ctrl+6: Settings</div>
                    <div>Ctrl+B: Toggle Sidebar</div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
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
          <div
            key={activeTab}
            className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
          >
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Welcome Section */}
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Welcome to FiLine Wall
                      </h1>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Your advanced call protection system is active and monitoring your phone line.
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-green-600 dark:text-green-400 font-medium">System Online</span>
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">
                          Last updated: {new Date().toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:block">
                      <Shield className="h-16 w-16 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                      <Smartphone className="h-5 w-5" />
                      Connected Devices
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {devices.length === 0 ? (
                        <div className="text-center py-8">
                          <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No Devices Connected
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Connect a modem or device to start monitoring your phone line.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab("devices")}
                          >
                            Configure Device
                          </Button>
                        </div>
                      ) : (
                        devices.map((device) => (
                          <div 
                            key={device.deviceId} 
                            className="p-3 border rounded-lg dark:border-gray-700 space-y-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                            onClick={() => setSelectedDeviceId(device.deviceId)}
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
        </div>
      </main>
    </div>
    </TooltipProvider>
  );
}