import { SidebarProvider } from "@/components/ui/sidebar-provider";
import { Sidebar } from "@/components/ui/sidebar";
import { Phone, Shield, ClipboardList } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const navigation: NavigationItem[] = [
  { name: "Dashboard", href: "/", icon: Shield },
  { name: "Number Management", href: "/numbers", icon: Phone },
  { name: "Call History", href: "/history", icon: ClipboardList },
];

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <Sidebar items={navigation} />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
