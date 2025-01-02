import * as React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-provider";
import type { LucideIcon } from "lucide-react";

interface SidebarProps {
  items: {
    name: string;
    href: string;
    icon: LucideIcon;
  }[];
}

export function Sidebar({ items }: SidebarProps) {
  const { isCollapsed } = useSidebar();
  const [location] = useLocation();

  return (
    <div className={cn(
      "flex h-screen w-[240px] flex-col border-r bg-sidebar",
      isCollapsed && "w-[80px]"
    )}>
      <div className="flex flex-col gap-2 p-4">
        {items.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2",
                  isCollapsed && "justify-center p-2"
                )}
              >
                <Icon className="h-5 w-5" />
                {!isCollapsed && <span>{item.name}</span>}
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

//The rest of the original file is removed as it is not needed in this simplified implementation.