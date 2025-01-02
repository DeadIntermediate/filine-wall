import { CallTable } from "@/components/CallTable";

export default function CallHistory() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Call History</h1>
      <CallTable />
    </div>
  );
}
