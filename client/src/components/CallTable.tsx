import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Info, Flag, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ReputationScore } from "./ReputationScore";

export function CallTable() {
  const { toast } = useToast();
  const { data: calls = [] } = useQuery({
    queryKey: ["/api/calls"],
  });

  const reportSpam = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await fetch("/api/spam-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          phoneNumber,
          category: "user_reported",
          description: "Reported via call history"
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to report spam");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      toast({
        title: "Number reported",
        description: "Thank you for helping protect the community.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to report number. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Phone Number</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Score</TableHead>
          <TableHead className="text-right">Report</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {calls.map((call: any) => (
          <TableRow key={call.id}>
            <TableCell>{call.phoneNumber}</TableCell>
            <TableCell>
              {new Date(call.timestamp).toLocaleString()}
            </TableCell>
            <TableCell>
              <Badge
                variant={call.action === "blocked" ? "destructive" : "default"}
              >
                {call.action}
              </Badge>
            </TableCell>
            <TableCell>
              {call.metadata?.dncStatus ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center">
                        <Badge variant="secondary">DNC Listed</Badge>
                        <Info className="h-4 w-4 ml-1" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Registered on: {new Date(call.metadata.dncStatus.registrationDate).toLocaleDateString()}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Badge variant="outline">Not Listed</Badge>
              )}
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {call.metadata?.lineType || "Unknown"}
              </Badge>
            </TableCell>
            <TableCell>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    View Score
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Reputation Score - {call.phoneNumber}</DialogTitle>
                  </DialogHeader>
                  <ReputationScore phoneNumber={call.phoneNumber} />
                </DialogContent>
              </Dialog>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => reportSpam.mutate(call.phoneNumber)}
                disabled={reportSpam.isPending || call.metadata?.isReported}
                className="flex items-center gap-2"
              >
                <Flag className="h-4 w-4" />
                {call.metadata?.isReported ? "Reported" : "Report Spam"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}