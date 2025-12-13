import { Switch, Route } from "wouter";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import MasterInterface from "@/pages/MasterInterface";
import DeviceInterface from "@/pages/DeviceInterface";
import VerifyCaller from "@/pages/VerifyCaller";
import { Layout } from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function App() {
  // No authentication - direct access for local deployment
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="ui-theme">
        <Layout>
          <Switch>
            {/* Main Interface - Always accessible */}
            <Route path="/" component={MasterInterface} />
            <Route path="/verify" component={VerifyCaller} />
            <Route path="/device" component={DeviceInterface} />

            {/* Fallback 404 */}
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

// fallback 404 not found page
function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            This page doesn't exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;