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
            <TableCell>{call.duration || "N/A"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
