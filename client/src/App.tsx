import { Switch, Route } from "wouter";
import Dashboard from "@/pages/Dashboard";
import NumberManagement from "@/pages/NumberManagement";
import CallHistory from "@/pages/CallHistory";
import { Layout } from "@/components/Layout";

function App() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/numbers" component={NumberManagement} />
        <Route path="/history" component={CallHistory} />
      </Switch>
    </Layout>
  );
}

export default App;