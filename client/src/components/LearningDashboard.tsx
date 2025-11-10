import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Brain, 
  TrendingUp, 
  Target, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  BarChart3
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface LearningProgress {
  currentAccuracy: number;
  improvementSinceStart: number;
  patternsLearned: number;
  lastLearningCycle: string;
  nextCycle: string;
  falsePositiveRate: number;
  missedSpamRate: number;
  totalCallsAnalyzed: number;
  recentInsights: Array<{
    id: string;
    pattern: string;
    confidence: number;
    sampleSize: number;
    applied: boolean;
    detectionRate: number;
    falsePositiveRate: number;
  }>;
  accuracyHistory: Array<{
    date: string;
    accuracy: number;
    falsePositiveRate: number;
  }>;
}

export function LearningDashboard() {
  const { data: progress, isLoading } = useQuery<LearningProgress>({
    queryKey: ["/api/analytics/learning-progress"],
    refetchInterval: 60000, // Refresh every minute
  });

  const { mutate: runLearningCycle, isPending } = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/analytics/run-learning-cycle", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to run learning cycle");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/learning-progress"] });
    },
  });

  if (isLoading || !progress) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  const accuracyColor = progress.currentAccuracy > 0.85 ? "text-green-600" : 
                        progress.currentAccuracy > 0.75 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8" />
            AI Learning Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">
            Continuous improvement through data analysis
          </p>
        </div>
        <Button 
          onClick={() => runLearningCycle()}
          disabled={isPending}
          variant="outline"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {isPending ? "Running..." : "Run Learning Cycle"}
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Accuracy</CardTitle>
            <Target className={`h-4 w-4 ${accuracyColor}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${accuracyColor}`}>
              {(progress.currentAccuracy * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {progress.improvementSinceStart > 0 ? (
                <span className="text-green-600 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +{(progress.improvementSinceStart * 100).toFixed(1)}% since start
                </span>
              ) : (
                "Baseline measurement"
              )}
            </p>
            <Progress 
              value={progress.currentAccuracy * 100} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Patterns Learned</CardTitle>
            <Brain className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress.patternsLearned}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Auto-discovered detection rules
            </p>
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                {progress.totalCallsAnalyzed.toLocaleString()} calls analyzed
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">False Positives</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(progress.falsePositiveRate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {progress.falsePositiveRate < 0.05 ? (
                <span className="text-green-600">Excellent - below 5% target</span>
              ) : progress.falsePositiveRate < 0.10 ? (
                <span className="text-yellow-600">Good - optimization ongoing</span>
              ) : (
                <span className="text-red-600">High - needs tuning</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Learning Cycle</CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {new Date(progress.nextCycle).toLocaleDateString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(progress.nextCycle).toLocaleTimeString()}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Last run: {new Date(progress.lastLearningCycle).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Accuracy Improvement Over Time
          </CardTitle>
          <CardDescription>
            System performance evolution through continuous learning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progress.accuracyHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <YAxis 
                  domain={[0, 1]}
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                />
                <Tooltip 
                  formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Line 
                  type="monotone" 
                  dataKey="accuracy" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Accuracy"
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="falsePositiveRate" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  name="False Positive Rate"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Recently Discovered Patterns
          </CardTitle>
          <CardDescription>
            New spam detection rules learned from call data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {progress.recentInsights.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No new patterns discovered yet. More data needed for learning.
              </p>
            ) : (
              progress.recentInsights.map((insight) => (
                <div 
                  key={insight.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{insight.pattern}</h4>
                      {insight.applied ? (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Applied
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Pending Review
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm text-muted-foreground mt-2">
                      <div>
                        <span className="font-medium">Confidence:</span>{" "}
                        <span className={
                          insight.confidence > 0.85 ? "text-green-600" :
                          insight.confidence > 0.70 ? "text-yellow-600" : "text-red-600"
                        }>
                          {(insight.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Sample Size:</span>{" "}
                        {insight.sampleSize.toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">Detection Rate:</span>{" "}
                        {(insight.detectionRate * 100).toFixed(1)}%
                      </div>
                      <div>
                        <span className="font-medium">FP Rate:</span>{" "}
                        <span className={
                          insight.falsePositiveRate < 0.05 ? "text-green-600" :
                          insight.falsePositiveRate < 0.10 ? "text-yellow-600" : "text-red-600"
                        }>
                          {(insight.falsePositiveRate * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  {!insight.applied && (
                    <Button size="sm" variant="outline">
                      Apply Now
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Learning Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Learning Status</CardTitle>
          <CardDescription>
            Current state of the continuous improvement engine
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Data Collection</span>
              <Badge variant="default">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pattern Discovery</span>
              <Badge variant="default">
                {progress.patternsLearned > 0 ? "Active" : "Waiting for data"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Threshold Optimization</span>
              <Badge variant="default">
                {progress.totalCallsAnalyzed > 1000 ? "Active" : "Insufficient data"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Community Learning</span>
              <Badge variant="outline">Coming Soon</Badge>
            </div>
          </div>

          {progress.totalCallsAnalyzed < 1000 && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Learning Progress:</strong> {progress.totalCallsAnalyzed} / 1,000 calls analyzed.
                {" "}The system needs at least 1,000 calls to begin discovering reliable patterns.
              </p>
              <Progress 
                value={(progress.totalCallsAnalyzed / 1000) * 100} 
                className="mt-2"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LearningDashboard;
