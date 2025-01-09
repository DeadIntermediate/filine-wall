import { SidebarProvider } from "@/components/ui/sidebar-provider";
import { Sidebar } from "@/components/ui/sidebar";
import { Phone, Shield, ClipboardList, Settings, Sun, Moon, Database } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { useTheme } from "@/components/ui/theme-provider";
import { Button } from "@/components/ui/button";

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const navigation: NavigationItem[] = [
  { name: "Dashboard", href: "/", icon: Shield },
  { name: "Number Management", href: "/numbers", icon: Phone },
  { name: "Call History", href: "/history", icon: ClipboardList },
  { name: "Spam Database", href: "/fcc-database", icon: Database },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { theme, setTheme } = useTheme();

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <Sidebar items={navigation}>
          <div className="flex items-center justify-center p-4 border-t">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-10 h-10"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </Sidebar>
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}