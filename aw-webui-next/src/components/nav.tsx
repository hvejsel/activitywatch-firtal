"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  GitBranch,
  Package,
  Settings,
  Brain,
  Target,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/processes", label: "Processes", icon: GitBranch },
  { href: "/objects", label: "Objects", icon: Package },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-2 p-4 border-r bg-muted/40 min-h-screen w-64">
      <div className="flex items-center gap-2 px-2 py-4 mb-4">
        <Brain className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">AW Intelligence</span>
      </div>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
