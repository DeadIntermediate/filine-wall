import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Info, RefreshCw, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReputationScore {
  score: number;
  factors: {
    communityReports: number;
    callHistory: number;
    blockRate: number;
    verificationStatus: number;
    timeFactors: number;
  };
  lastUpdate: string;
  trend: "improving" | "declining" | "stable";
}

export function NumberList() {
  const { data: numbers } = useQuery({
    queryKey: ["/api/numbers"],
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const refreshReputation = useMutation({
    mutationFn: async (number: string) => {
      const res = await fetch(`/api/numbers/${number}/reputation/refresh`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to refresh reputation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/numbers"] });
      toast({
        title: "Reputation refreshed",
        description: "The reputation score has been recalculated.",
      });
    },
  });

  const deleteNumber = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/numbers/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete number");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/numbers"] });
      toast({
        title: "Number deleted",
        description: "The number has been removed from the list.",
      });
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Reputation</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Added On</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {numbers?.map((number: any) => (
          <TableRow key={number.id}>
            <TableCell>{number.number}</TableCell>
            <TableCell>
              <Badge
                variant={number.type === "blacklist" ? "destructive" : "secondary"}
              >
                {number.type === "blacklist" ? "Blocked" : "Allowed"}
              </Badge>
            </TableCell>
            <TableCell>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{number.reputationScore}</span>
                        {getTrendIcon(number.scoreFactors?.trend)}
                      </div>
                      <Progress 
                        value={number.reputationScore} 
                        className={`h-2 w-24 ${getScoreColor(number.reputationScore)}`}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-2">
                      <p className="font-semibold">Reputation Factors:</p>
                      {number.scoreFactors && (
                        <div className="space-y-1 text-sm">
                          <p>Community Reports: {number.scoreFactors.communityReports}%</p>
                          <p>Call History: {number.scoreFactors.callHistory}%</p>
                          <p>Block Rate: {number.scoreFactors.blockRate}%</p>
                          <p>Verification: {number.scoreFactors.verificationStatus}%</p>
                          <p>Time Patterns: {number.scoreFactors.timeFactors}%</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Last updated: {new Date(number.lastScoreUpdate).toLocaleString()}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>
            <TableCell>
              {number.description ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1">
                      <span className="truncate max-w-[200px]">
                        {number.description}
                      </span>
                      <Info className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs whitespace-normal">
                        {number.description}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className="text-muted-foreground">No reason provided</span>
              )}
            </TableCell>
            <TableCell>
              {new Date(number.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refreshReputation.mutate(number.number)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteNumber.mutate(number.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}