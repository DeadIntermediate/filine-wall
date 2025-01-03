import * as React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-provider";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft } from "lucide-react";

interface SidebarProps {
  items: {
    name: string;
    href: string;
    icon: LucideIcon;
  }[];
  children?: React.ReactNode;
}

export function Sidebar({ items, children }: SidebarProps) {
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const [location] = useLocation();

  return (
    <motion.div
      layout
      className={cn(
        "relative flex h-screen flex-col border-r bg-sidebar transition-all duration-300",
        isCollapsed ? "w-[80px]" : "w-[240px]"
      )}
      initial={false}
      animate={{
        width: isCollapsed ? 80 : 240,
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30
      }}
    >
      <div className="flex flex-col gap-2 p-4">
        <AnimatePresence mode="wait" initial={false}>
          {items.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <Link href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-2 transition-all duration-200",
                      isCollapsed ? "justify-center p-2" : ""
                    )}
                  >
                    <motion.div
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <Icon className="h-5 w-5" />
                    </motion.div>
                    <AnimatePresence mode="wait">
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {item.name}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {children}

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleCollapsed}
        className="absolute -right-3 top-6 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-md"
      >
        <motion.div
          animate={{ rotate: isCollapsed ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <ChevronLeft className="h-4 w-4" />
        </motion.div>
      </motion.button>
    </motion.div>
  );
}