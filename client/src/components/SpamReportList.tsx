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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ThumbsUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function SpamReportList() {
  const { data: reports } = useQuery({
    queryKey: ["/api/reports"],
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const confirmReport = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/reports/${id}/confirm`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to confirm report");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({
        title: "Report confirmed",
        description: "Thank you for your contribution!",
      });
    },
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Reported</TableHead>
          <TableHead>Confirmations</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports?.map((report: any) => (
          <TableRow key={report.id}>
            <TableCell>{report.phoneNumber}</TableCell>
            <TableCell>
              <Badge variant="outline" className="capitalize">
                {report.category}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  report.status === "verified"
                    ? "success"
                    : report.status === "rejected"
                    ? "destructive"
                    : "secondary"
                }
              >
                {report.status}
              </Badge>
            </TableCell>
            <TableCell>
              {new Date(report.reportedAt).toLocaleDateString()}
            </TableCell>
            <TableCell>{report.confirmations}</TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                onClick={() => confirmReport.mutate(report.id)}
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                Confirm
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
