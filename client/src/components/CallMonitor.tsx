import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, 
  PhoneOff, 
  PhoneIncoming, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CallLog {
  id: number;
  phoneNumber: string;
  callerName?: string;
  timestamp: string;
  action: 'blocked' | 'allowed' | 'screened';
  riskScore: number;
  reason?: string;
  source?: string;
}

export function CallMonitor() {
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch call logs
  const { data: recentCalls = [] } = useQuery<CallLog[]>({
    queryKey: ["/api/user/calls"],
    refetchInterval: isPaused ? false : 3000, // Refresh every 3 seconds when not paused
  });

  // Update logs when new data comes in
  useEffect(() => {
    if (recentCalls.length > 0) {
      setLogs(recentCalls);
    }
  }, [recentCalls]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const clearLogs = () => {
    setLogs([]);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'blocked':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'allowed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'screened':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Phone className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
      blocked: "destructive",
      allowed: "default",
      screened: "secondary",
    };
    return (
      <Badge variant={variants[action] || "outline"} className="text-xs">
        {action.toUpperCase()}
      </Badge>
    );
  };

  const getRiskColor = (score: number) => {
    if (score >= 0.7) return "text-red-500 font-bold";
    if (score >= 0.4) return "text-yellow-500 font-semibold";
    return "text-green-500";
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <CardTitle>Live Call Monitor</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
              className="flex items-center space-x-1"
            >
              {isPaused ? (
                <>
                  <Play className="h-4 w-4" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  <span>Pause</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearLogs}
              className="flex items-center space-x-1"
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear</span>
            </Button>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-2">
          <div className="flex items-center space-x-1">
            <div className={cn("h-2 w-2 rounded-full", isPaused ? "bg-red-500" : "bg-green-500 animate-pulse")} />
            <span>{isPaused ? 'Paused' : 'Live'}</span>
          </div>
          <span>|</span>
          <span>{logs.length} calls logged</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-[500px] px-6" ref={scrollRef}>
          <div className="space-y-3 py-4">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <PhoneIncoming className="h-12 w-12 mb-4 opacity-50" />
                <p>No calls detected yet</p>
                <p className="text-sm">Waiting for incoming calls...</p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm">
                          {log.phoneNumber}
                        </span>
                        {log.callerName && (
                          <span className="text-sm text-muted-foreground">
                            ({log.callerName})
                          </span>
                        )}
                      </div>
                      {getActionBadge(log.action)}
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                      <span>{formatTime(log.timestamp)}</span>
                      <span>|</span>
                      <span className={getRiskColor(log.riskScore)}>
                        Risk: {(log.riskScore * 100).toFixed(0)}%
                      </span>
                      {log.reason && (
                        <>
                          <span>|</span>
                          <span className="truncate">{log.reason}</span>
                        </>
                      )}
                    </div>
                    {log.source && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Source: {log.source}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
