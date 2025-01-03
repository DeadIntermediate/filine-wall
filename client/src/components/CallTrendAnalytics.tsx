import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Phone, Shield, AlertTriangle, Ban, Clock } from "lucide-react";

interface DailyStats {
  date: string;
  blocked: number;
  allowed: number;
}

interface TimeDistribution {
  hour: number;
  count: number;
  risk: number;
}

const timeRanges = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
];

export function CallTrendAnalytics() {
  const [selectedRange, setSelectedRange] = useState("7");

  // Fetch daily statistics
  const { data: dailyStats } = useQuery<{ daily: DailyStats[] }>({
    queryKey: [`/api/stats/daily?days=${selectedRange}`],
  });

  // Fetch hourly distribution
  const { data: timeDistribution } = useQuery<TimeDistribution[]>({
    queryKey: ["/api/stats/time-distribution"],
  });

  // Calculate trend indicators
  const calculateTrend = (data: DailyStats[]) => {
    if (!data || data.length < 2) return { trend: 0, percentage: 0 };
    
    const recent = data.slice(-2);
    const change = recent[1].blocked - recent[0].blocked;
    const percentage = Math.round((change / Math.max(recent[0].blocked, 1)) * 100);
    
    return { trend: Math.sign(change), percentage: Math.abs(percentage) };
  };

  const trend = dailyStats?.daily ? calculateTrend(dailyStats.daily) : { trend: 0, percentage: 0 };

  // Format data for charts
  const formattedDailyStats = dailyStats?.daily?.map(day => ({
    ...day,
    date: format(new Date(day.date), "MMM dd"),
    total: day.blocked + day.allowed,
    blockRate: Math.round((day.blocked / (day.blocked + day.allowed)) * 100)
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Call Trend Analytics</h2>
        <Select value={selectedRange} onValueChange={setSelectedRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeRanges.map(range => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Call Volume Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={formattedDailyStats}>
                    <defs>
                      <linearGradient id="blockedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="allowedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="blocked" 
                      stroke="#ef4444" 
                      fillOpacity={1}
                      fill="url(#blockedGradient)"
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="allowed" 
                      stroke="#22c55e" 
                      fillOpacity={1}
                      fill="url(#allowedGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(hour) => `${hour}:00`}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="count" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="risk" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={`trend-${trend.trend}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {trend.trend > 0 ? (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  ) : trend.trend < 0 ? (
                    <Shield className="h-5 w-5 text-green-500" />
                  ) : (
                    <Ban className="h-5 w-5 text-gray-500" />
                  )}
                  Trend Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {trend.trend > 0 ? "↑" : trend.trend < 0 ? "↓" : "–"}
                    {trend.percentage}%
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {trend.trend > 0 
                      ? "Increase in spam calls" 
                      : trend.trend < 0 
                      ? "Decrease in spam calls"
                      : "No significant change"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
