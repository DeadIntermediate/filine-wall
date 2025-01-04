import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, PhoneCall, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface FCCSpamRecord {
  phoneNumber: string;
  reportCount: number;
  lastReported: string;
  category: string;
}

export function FCCDatabaseView() {
  const { toast } = useToast();
  const { data: numbers = [], isLoading } = useQuery<FCCSpamRecord[]>({
    queryKey: ["/api/fcc-database"],
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/fcc-database/refresh", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to refresh database");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fcc-database"] });
      toast({
        title: "Database Refreshed",
        description: "The spam number database has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to refresh the database. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-5 w-5" />
          <CardTitle>FCC Spam Number Database</CardTitle>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {refreshMutation.isPending ? 'Refreshing...' : 'Refresh Database'}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone Number</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Report Count</TableHead>
                <TableHead>Last Reported</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {numbers.map((entry) => (
                <TableRow key={entry.phoneNumber}>
                  <TableCell>{entry.phoneNumber}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{entry.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {entry.reportCount}
                      {entry.reportCount > 10 && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(entry.lastReported).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}