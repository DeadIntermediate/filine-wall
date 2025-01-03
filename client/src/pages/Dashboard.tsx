import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Statistics } from "@/components/Statistics";
import { HeatmapView } from "@/components/HeatmapView";
import { RiskScoreGauge } from "@/components/RiskScoreGauge";
import { SettingsPanel } from "@/components/SettingsPanel";
import { CallTrendAnalytics } from "@/components/CallTrendAnalytics";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ChartBar, Cog } from "lucide-react";

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
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold"
        >
          Dashboard
        </motion.h1>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="w-full border-b bg-background p-0">
          <motion.div 
            className="container flex h-14 max-w-screen-2xl items-center gap-6"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <TabsTrigger 
              value="overview"
              className="group relative h-full rounded-none border-b-2 border-b-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground"
            >
              <motion.div
                className="flex items-center gap-2"
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Shield className="h-4 w-4" />
                Overview
              </motion.div>
            </TabsTrigger>
            <TabsTrigger 
              value="analytics"
              className="group relative h-full rounded-none border-b-2 border-b-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground"
            >
              <motion.div
                className="flex items-center gap-2"
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <ChartBar className="h-4 w-4" />
                Analytics
              </motion.div>
            </TabsTrigger>
            <TabsTrigger 
              value="settings"
              className="group relative h-full rounded-none border-b-2 border-b-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground"
            >
              <motion.div
                className="flex items-center gap-2"
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Cog className="h-4 w-4" />
                Settings
              </motion.div>
            </TabsTrigger>
          </motion.div>
        </TabsList>

        <AnimatePresence mode="wait">
          <TabsContent value="overview">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-6"
            >
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  { title: "Total Blocked", value: stats?.totalBlocked || 0 },
                  { title: "Blacklisted Numbers", value: stats?.blacklistedCount || 0 },
                  { title: "Today's Blocks", value: stats?.todayBlocks || 0 },
                  { component: <RiskScoreGauge score={riskScore?.currentRisk || 0} label="Current Risk Level" /> }
                ].map((item, index) => (
                  <motion.div
                    key={item.title || 'risk-gauge'}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    {item.component ? (
                      item.component
                    ) : (
                      <Card>
                        <CardHeader>
                          <CardTitle>{item.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold">{item.value}</p>
                        </CardContent>
                      </Card>
                    )}
                  </motion.div>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Call Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <CallTrendAnalytics />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="analytics">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-6"
            >
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Geographic Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <HeatmapView />
                  </CardContent>
                </Card>
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
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <SettingsPanel />
            </motion.div>
          </TabsContent>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}