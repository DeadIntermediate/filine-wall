import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Shield, Activity, Clock, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface DiagnosticResult {
  status: "success" | "warning" | "error";
  message: string;
  details?: {
    latency?: number;
    encryptionStatus?: boolean;
    systemLoad?: number;
    memoryUsage?: number;
    securityScore?: number;
  };
}

interface DiagnosticResponse {
  connectivity: DiagnosticResult;
  encryption: DiagnosticResult;
  performance: DiagnosticResult;
  security: DiagnosticResult;
}

export function DeviceDiagnosticTool({ deviceId }: { deviceId: string }) {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<DiagnosticResponse | null>(null);

  const runDiagnostic = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/devices/${deviceId}/diagnostic`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to run diagnostic");
      return response.json();
    },
    onMutate: () => {
      setIsRunning(true);
      setProgress(0);
      setResults(null);

      // Simulate progress updates
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 5;
        });
      }, 200);

      return () => clearInterval(interval);
    },
    onSuccess: (data) => {
      setResults(data);
      toast({
        title: "Diagnostic Complete",
        description: "Device health check completed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to run device diagnostic. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsRunning(false);
      setProgress(100);
    },
  });

  const getStatusIcon = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <Button 
        onClick={() => runDiagnostic.mutate()} 
        disabled={isRunning}
        className="w-full"
      >
        {isRunning ? (
          <>Running Diagnostic...</>
        ) : (
          <>Run Health Check</>
        )}
      </Button>

      {isRunning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground text-center">
            Running device diagnostics... {progress}%
          </p>
        </motion.div>
      )}

      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {Object.entries(results).map(([key, result]) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <Alert>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <h4 className="font-medium capitalize">{key}</h4>
                      <AlertDescription>{result.message}</AlertDescription>
                    </div>
                    {result.details && (
                      <div className="flex items-center gap-4">
                        {result.details.latency && (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-4 w-4" />
                            {result.details.latency}ms
                          </div>
                        )}
                        {result.details.systemLoad && (
                          <div className="flex items-center gap-1 text-sm">
                            <Cpu className="h-4 w-4" />
                            {result.details.systemLoad}%
                          </div>
                        )}
                        {result.details.securityScore && (
                          <div className="flex items-center gap-1 text-sm">
                            <Shield className="h-4 w-4" />
                            {result.details.securityScore}/100
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Alert>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
