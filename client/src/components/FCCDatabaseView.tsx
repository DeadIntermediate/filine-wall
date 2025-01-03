import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, PhoneCall } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FCCSpamRecord {
  phoneNumber: string;
  reportCount: number;
  lastReported: string;
  category: string;
}

export function FCCDatabaseView() {
  const { data: numbers = [], isLoading } = useQuery<FCCSpamRecord[]>({
    queryKey: ["/api/fcc-database"],
  });

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PhoneCall className="h-5 w-5" />
          FCC Spam Number Database
        </CardTitle>
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