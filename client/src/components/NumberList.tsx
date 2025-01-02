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
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function NumberList() {
  const { data: numbers } = useQuery({
    queryKey: ["/api/numbers"],
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Type</TableHead>
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
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteNumber.mutate(number.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}