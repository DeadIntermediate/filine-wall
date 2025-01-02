import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export function CallTable() {
  const { data: calls } = useQuery({
    queryKey: ["/api/calls"],
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Phone Number</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Duration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {calls?.map((call: any) => (
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
            <TableCell>{call.duration || "N/A"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}