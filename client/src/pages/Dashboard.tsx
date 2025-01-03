import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Statistics } from "@/components/Statistics";
import { HeatmapView } from "@/components/HeatmapView";
import { RiskScoreGauge } from "@/components/RiskScoreGauge";
import { SettingsPanel } from "@/components/SettingsPanel";
import { CallTrendAnalytics } from "@/components/CallTrendAnalytics";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

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

      <Tabs defaultValue="statistics" className="space-y-6">
        <TabsList className="w-full border-b bg-background p-0">
          <motion.div 
            className="container flex h-14 max-w-screen-2xl items-center gap-6"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <TabsTrigger 
              value="statistics"
              className="group relative h-full rounded-none border-b-2 border-b-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground"
            >
              <motion.span
                className="relative"
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                Statistics
              </motion.span>
            </TabsTrigger>
            <TabsTrigger 
              value="settings"
              className="group relative h-full rounded-none border-b-2 border-b-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground"
            >
              <motion.span
                className="relative"
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                Settings
              </motion.span>
            </TabsTrigger>
          </motion.div>
        </TabsList>

        <div className="grid gap-4 md:grid-cols-4">
          <AnimatePresence mode="wait">
            {[
              { title: "Total Blocked", value: stats?.totalBlocked || 0 },
              { title: "Blacklisted Numbers", value: stats?.blacklistedCount || 0 },
              { title: "Today's Blocks", value: stats?.todayBlocks || 0 },
            ].map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, type: "spring", stiffness: 300, damping: 30 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>{stat.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stat.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 30 }}
            >
              <RiskScoreGauge score={riskScore?.currentRisk || 0} label="Current Risk Level" />
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          <TabsContent value="statistics" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
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