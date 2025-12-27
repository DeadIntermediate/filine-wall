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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl">Invalid Request</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="border-red-200 dark:border-red-800">
              <AlertDescription className="text-center">
                No phone number provided. Please ensure you have a valid verification link.
              </AlertDescription>
            </Alert>
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => window.location.href = '/'}
                className="w-full"
              >
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-300">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Verify Your Call</CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Confirm this is a legitimate call from <span className="font-mono font-semibold">{phoneNumber}</span>
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyCode.mutate();
            }}
            className="space-y-6"
          >
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Verification Code
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Enter the 6-digit code provided during your call to allow future calls from this number.
              </p>
              <Input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono border-2 focus:border-blue-500 transition-colors"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
              disabled={verifyCode.isPending || code.length !== 6}
            >
              {verifyCode.isPending ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Verifying...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Verify Number
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              This verification helps protect against unwanted calls while allowing legitimate communications.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}