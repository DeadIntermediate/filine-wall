import { Switch, Route } from "wouter";
import Dashboard from "@/pages/Dashboard";
import NumberManagement from "@/pages/NumberManagement";
import CallHistory from "@/pages/CallHistory";
import Settings from "@/pages/Settings";
import VerifyCaller from "@/pages/VerifyCaller";
import { Layout } from "@/components/Layout";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { FCCDatabaseView } from "@/components/FCCDatabaseView";
import { Changelog } from "@/components/Changelog";

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="ui-theme">
      <Switch>
        <Route path="/verify">
          <VerifyCaller />
        </Route>
        <Route>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/numbers" component={NumberManagement} />
              <Route path="/history" component={CallHistory} />
              <Route path="/settings" component={Settings} />
              <Route path="/fcc-database" component={FCCDatabaseView} />
              <Route path="/changelog" component={Changelog} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
    </ThemeProvider>
  );
}

export default App;