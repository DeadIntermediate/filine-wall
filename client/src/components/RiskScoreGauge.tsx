import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Shield, AlertTriangle, XCircle } from "lucide-react";

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

  const getRiskIcon = (score: number) => {
    if (score < 30) return <Shield className="h-6 w-6 text-green-500" />;
    if (score < 70) return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
    return <XCircle className="h-6 w-6 text-red-500" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getRiskIcon(score)}
          {label || "Risk Score"}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-[200px] w-full">
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
                <Cell key="score" fill={getRiskColor(score)} />
                <Cell key="remaining" fill="#e5e7eb" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 text-center">
            <p className="text-2xl font-bold">{score}%</p>
            <p className="text-sm text-muted-foreground">Current Risk Level</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
