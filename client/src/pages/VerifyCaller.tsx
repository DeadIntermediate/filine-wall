import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle, XCircle } from "lucide-react";

export default function VerifyCaller() {
  // Get phone number from URL query params
  const [location] = useLocation();
  const params = new URLSearchParams(location.split('?')[1]);
  const [code, setCode] = useState("");
  const { toast } = useToast();
  const phoneNumber = params.get("phone");

  const verifyCode = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, code }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Verification successful",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!phoneNumber) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Invalid Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                No phone number provided. Please ensure you have a valid verification link.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Verify Your Call
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyCode.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Enter the verification code provided during your call to {phoneNumber}.
                This will add your number to our allow list for future calls.
              </p>
            </div>

            <div className="space-y-2">
              <Input
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center text-2xl tracking-wide"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={verifyCode.isPending}
            >
              {verifyCode.isPending ? (
                "Verifying..."
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Verify
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}