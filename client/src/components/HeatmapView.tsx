import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface CallLocation {
  lat: number;
  long: number;
  intensity: number;
}

export const HeatmapView = memo(function HeatmapView() {
  const { data: locations, isLoading } = useQuery<CallLocation[]>({
    queryKey: ["/api/calls/heatmap"],
  });

  if (isLoading) {
    return <Skeleton className="w-full h-[400px]" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spam Call Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full bg-muted rounded-lg p-4 relative">
          {locations?.map((location, index) => (
            <div
              key={index}
              className="absolute rounded-full bg-destructive/50"
              style={{
                left: `${((location.long + 180) / 360) * 100}%`,
                top: `${((90 - location.lat) / 180) * 100}%`,
                width: `${Math.max(10, (location.intensity / 100) * 40)}px`,
                height: `${Math.max(10, (location.intensity / 100) * 40)}px`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
          <div className="absolute inset-0 border-2 border-dashed border-border" />
        </div>
      </CardContent>
    </Card>
  );
});