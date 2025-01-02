import { Switch, Route } from "wouter";
import Dashboard from "@/pages/Dashboard";
import NumberManagement from "@/pages/NumberManagement";
import CallHistory from "@/pages/CallHistory";
import VerifyCaller from "@/pages/VerifyCaller";
import { Layout } from "@/components/Layout";

function App() {
  return (
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
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

export default App;