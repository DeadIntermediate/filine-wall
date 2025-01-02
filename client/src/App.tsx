import { Switch, Route } from "wouter";
import { Sidebar } from "@/components/ui/sidebar";
import Dashboard from "@/pages/Dashboard";
import NumberManagement from "@/pages/NumberManagement";
import CallHistory from "@/pages/CallHistory";
import { Phone, Shield, ClipboardList } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar-provider";
import type { LucideIcon } from "lucide-react";

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

function App() {
  const navigation: NavigationItem[] = [
    { name: "Dashboard", href: "/", icon: Shield },
    { name: "Number Management", href: "/numbers", icon: Phone },
    { name: "Call History", href: "/history", icon: ClipboardList },
  ];

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <Sidebar items={navigation} />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/numbers" component={NumberManagement} />
            <Route path="/history" component={CallHistory} />
          </Switch>
        </main>
      </div>
    </SidebarProvider>
  );
}

export default App;