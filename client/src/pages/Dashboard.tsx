import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Statistics } from "@/components/Statistics";
import { HeatmapView } from "@/components/HeatmapView";
import { RiskScoreGauge } from "@/components/RiskScoreGauge";
import { SettingsPanel } from "@/components/SettingsPanel";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: riskScore } = useQuery({
    queryKey: ["/api/risk-score"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalBlocked || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Blacklisted Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.blacklistedCount || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.todayBlocks || 0}</p>
          </CardContent>
        </Card>

        <RiskScoreGauge score={riskScore?.currentRisk || 0} label="Current Risk Level" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <HeatmapView />
        <SettingsPanel />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Call Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <Statistics />
        </CardContent>
      </Card>
    </div>
  );
}