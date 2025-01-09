import { Switch, Route, useLocation } from "wouter";
import Dashboard from "@/pages/Dashboard";
import NumberManagement from "@/pages/NumberManagement";
import CallHistory from "@/pages/CallHistory";
import Settings from "@/pages/Settings";
import VerifyCaller from "@/pages/VerifyCaller";
import { Layout } from "@/components/Layout";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { FCCDatabaseView } from "@/components/FCCDatabaseView";
import { Changelog } from "@/components/Changelog";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

// New imports for auth
import { LoginPage } from "@/pages/auth/LoginPage";
import { useAuth } from "@/hooks/useAuth";

function App() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // If loading auth state, show loading
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // If no user and not on login page, redirect to login
  if (!user && !location.startsWith("/auth")) {
    window.location.href = "/auth/login";
    return null;
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="ui-theme">
      <Switch>
        {/* Public routes */}
        <Route path="/auth/login" component={LoginPage} />

        {/* User Interface Routes */}
        <Route path="/verify">
          <VerifyCaller />
        </Route>

        {/* Protected routes */}
        <Route>
          <Layout>
            <Switch>
              {/* Admin/Master Interface Routes */}
              {user?.role === 'admin' && (
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/numbers" component={NumberManagement} />
                  <Route path="/history" component={CallHistory} />
                  <Route path="/settings" component={Settings} />
                  <Route path="/fcc-database" component={FCCDatabaseView} />
                  <Route path="/changelog" component={Changelog} />
                </Switch>
              )}

              {/* User Interface Routes */}
              {user?.role === 'user' && (
                <Switch>
                  <Route path="/" component={CallHistory} />
                  <Route path="/verify" component={VerifyCaller} />
                </Switch>
              )}

              {/* Fallback 404 */}
              <Route>
                <NotFound />
              </Route>
            </Switch>
          </Layout>
        </Route>
      </Switch>
    </ThemeProvider>
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
            This page doesn't exist or you don't have permission to access it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;