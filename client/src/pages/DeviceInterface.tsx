import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PhoneCall, Shield, AlertTriangle } from "lucide-react";
import { CallTable } from "@/components/CallTable";
import { ReputationScore } from "@/components/ReputationScore";
import { useState } from "react";

interface Call {
  id: number;
  phoneNumber: string;
  timestamp: string;
  action: string;
  duration: string;
  metadata: Record<string, any>;
}

interface BlockedNumber {
  id: number;
  number: string;
  type: string;
  description: string;
}

export default function DeviceInterface() {
  const [phoneNumberToCheck, setPhoneNumberToCheck] = useState("");

  // Fetch user's call history
  const { data: calls = [] } = useQuery<Call[]>({
    queryKey: ["/api/user/calls"],
  });

  // Fetch blocked numbers
  const { data: blockedNumbers = [] } = useQuery<BlockedNumber[]>({
    queryKey: ["/api/user/numbers"],
  });

  // Handle reputation check
  const handleReputationCheck = async (phoneNumber: string) => {
    try {
      const response = await fetch(`/api/user/numbers/${phoneNumber}/reputation`);
      if (!response.ok) throw new Error('Failed to check reputation');
      const data = await response.json();
      // Handle the reputation data as needed
    } catch (error) {
      console.error('Error checking reputation:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">FiLine Wall Device Portal</h1>
        <Button variant="outline">
          <Shield className="w-4 h-4 mr-2" />
          Protection Active
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5" />
              Call Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>Total Calls: {calls.length}</p>
              <p>
                Blocked Calls: {calls.filter(call => call.action === "blocked").length}
              </p>
              <p>
                Safe Calls: {calls.filter(call => call.action === "allowed").length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Blocked Numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>Total Blocked: {blockedNumbers.length}</p>
              <Button variant="outline" size="sm">
                View Blocked List
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button className="w-full" variant="outline">
                Report Spam Number
              </Button>
              <Button className="w-full" variant="outline">
                Verify Caller
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Call History</CardTitle>
        </CardHeader>
        <CardContent>
          <CallTable calls={calls} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Number Reputation Checker</CardTitle>
        </CardHeader>
        <CardContent>
          <ReputationScore 
            phoneNumber={phoneNumberToCheck}
            onCheck={handleReputationCheck}
          />
        </CardContent>
      </Card>
    </div>
  );
}