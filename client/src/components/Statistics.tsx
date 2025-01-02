import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function Statistics() {
  const { data: stats } = useQuery({
    queryKey: ["/api/stats/daily"],
  });

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={stats?.daily || []}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="blocked"
            stroke="hsl(var(--destructive))"
            name="Blocked Calls"
          />
          <Line
            type="monotone"
            dataKey="allowed"
            stroke="hsl(var(--primary))"
            name="Allowed Calls"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
