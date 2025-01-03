import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Shield, AlertTriangle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface RiskScoreGaugeProps {
  score: number;
  label?: string;
}

export function RiskScoreGauge({ score, label }: RiskScoreGaugeProps) {
  const [data, setData] = useState([
    { name: "score", value: score },
    { name: "remaining", value: 100 - score }
  ]);

  useEffect(() => {
    setData([
      { name: "score", value: score },
      { name: "remaining", value: 100 - score }
    ]);
  }, [score]);

  const getRiskColor = (score: number) => {
    if (score < 30) return "#22c55e"; // Low risk - green
    if (score < 70) return "#eab308"; // Medium risk - yellow
    return "#ef4444"; // High risk - red
  };

  const getRiskLevel = (score: number) => {
    if (score < 30) return "Low";
    if (score < 70) return "Medium";
    return "High";
  };

  const getRiskIcon = (score: number) => {
    if (score < 30) return <Shield className="h-6 w-6 text-green-500" />;
    if (score < 70) return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
    return <XCircle className="h-6 w-6 text-red-500" />;
  };

  const getRiskDescription = (score: number) => {
    if (score < 30) return "Safe - Normal call patterns detected";
    if (score < 70) return "Caution - Some suspicious activity";
    return "Warning - High risk of spam calls";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.5 }}
          >
            {getRiskIcon(score)}
          </motion.div>
          {label || "Risk Score"}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <motion.div 
          className="h-[200px] w-full"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                startAngle={180}
                endAngle={0}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={0}
                dataKey="value"
              >
                <Cell key="score" fill={getRiskColor(score)}>
                  <animate
                    attributeName="fill"
                    values={`${getRiskColor(0)};${getRiskColor(score)}`}
                    dur="0.5s"
                  />
                </Cell>
                <Cell key="remaining" fill="#e5e7eb" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <motion.div 
            className="mt-4 text-center space-y-2"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <motion.p 
              className="text-2xl font-bold"
              key={score}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {score}%
            </motion.p>
            <AnimatePresence mode="wait">
              <motion.div
                key={getRiskLevel(score)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-1"
              >
                <p className={`font-semibold ${
                  score < 30 ? "text-green-500" : 
                  score < 70 ? "text-yellow-500" : 
                  "text-red-500"
                }`}>
                  {getRiskLevel(score)} Risk Level
                </p>
                <p className="text-sm text-muted-foreground">
                  {getRiskDescription(score)}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </CardContent>
    </Card>
  );
}