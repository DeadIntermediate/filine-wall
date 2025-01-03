import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Statistics } from "@/components/Statistics";
import { HeatmapView } from "@/components/HeatmapView";
import { RiskScoreGauge } from "@/components/RiskScoreGauge";
import { SettingsPanel } from "@/components/SettingsPanel";
import { CallTrendAnalytics } from "@/components/CallTrendAnalytics";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

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

      <Tabs defaultValue="statistics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="statistics" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <CallTrendAnalytics />

            <div className="grid gap-6 md:grid-cols-2 mt-6">
              <HeatmapView />
              <Card>
                <CardHeader>
                  <CardTitle>Call Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <Statistics />
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="settings">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <SettingsPanel />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}