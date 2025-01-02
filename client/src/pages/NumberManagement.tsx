import { useState } from "react";
import { NumberList } from "@/components/NumberList";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

export default function NumberManagement() {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [listType, setListType] = useState("blacklist");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addNumber = useMutation({
    mutationFn: async (data: { number: string; type: string; description?: string }) => {
      const res = await fetch("/api/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add number");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/numbers"] });
      setOpen(false);
      setNumber("");
      toast({
        title: "Number added successfully",
        description: `The number has been added to the ${listType}.`,
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Number Management</h1>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Number
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Number</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addNumber.mutate({ number, type: listType });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="number">Phone Number</Label>
                <Input
                  id="number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>

              <div className="space-y-2">
                <Label>List Type</Label>
                <RadioGroup
                  value={listType}
                  onValueChange={setListType}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="blacklist" id="blacklist" />
                    <Label htmlFor="blacklist">Block List</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="whitelist" id="whitelist" />
                    <Label htmlFor="whitelist">Allow List</Label>
                  </div>
                </RadioGroup>
              </div>

              <Button type="submit" className="w-full">
                Add to {listType === "blacklist" ? "Block" : "Allow"} List
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <NumberList />
    </div>
  );
}