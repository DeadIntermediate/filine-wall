import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface ReputationScoreProps {
  phoneNumber: string;
}

export function ReputationScore({ phoneNumber }: ReputationScoreProps) {
  const { toast } = useToast();
  const { data: reputation, isLoading } = useQuery({
    queryKey: [`/api/numbers/${phoneNumber}/reputation`],
    enabled: !!phoneNumber,
  });

  const refreshScore = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/numbers/${phoneNumber}/reputation/refresh`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to refresh score");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Score Updated",
        description: `New reputation score: ${data.score}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update reputation score",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  const score = reputation?.score || 0;
  const factors = reputation?.factors || {};
  const trend = reputation?.trend || "stable";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {score >= 70 ? (
            <Shield className="h-5 w-5 text-green-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          )}
          Reputation Score
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refreshScore.mutate()}
          disabled={refreshScore.isPending}
        >
          <RefreshCw className={`h-4 w-4 ${refreshScore.isPending ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm">{score}/100</span>
              <span className="text-sm text-muted-foreground capitalize">{trend}</span>
            </div>
            <Progress value={score} className="h-2" />
          </div>

          <div className="space-y-2">
            {Object.entries(factors).map(([factor, value]) => (
              <div key={factor} className="flex justify-between items-center">
                <span className="text-sm capitalize">
                  {factor.replace(/([A-Z])/g, " $1").toLowerCase()}
                </span>
                <span className="text-sm font-medium">{value}/100</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
