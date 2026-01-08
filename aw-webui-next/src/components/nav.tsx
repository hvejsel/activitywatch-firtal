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
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
          <path d="M 10.2 2.54 C 10.6 1.81 11.2 1.16 11.96 0.58 C 12.08 0.48 12.19 0.5 12.29 0.62 C 12.7 1.1 12.93 1.63 12.97 2.21 C 12.98 2.29 12.97 2.36 12.92 2.42 C 10.7 6.05 9.3 9.52 9.38 13.5 C 9.38 13.58 9.31 13.65 9.23 13.66 C 7.96 13.76 6.68 13.57 5.47 13.09 C 5.38 13.05 5.33 12.95 5.35 12.84 C 6.16 8.99 7.55 5.56 10.2 2.54 Z" fill="#673ae4"/>
          <path d="M 17.07 13.19 C 15.46 14.45 13.74 15.56 11.93 16.52 C 10.19 17.43 8.26 18.3 6.29 18.35 C 5.22 18.37 4.71 17.83 4.51 16.78 C 4.32 15.79 4.32 14.75 4.5 13.67 C 4.5 13.65 4.52 13.63 4.54 13.62 C 4.56 13.61 4.58 13.6 4.61 13.61 C 7.88 14.55 11.48 13.74 14.49 12.07 C 15.65 11.43 16.78 11.54 17.55 12.75 C 17.73 13.04 17.66 13.15 17.32 13.07 C 17.29 13.06 17.23 13.07 17.12 13.11 C 17.06 13.13 17 13.16 16.95 13.19 Z M 13.16 16.06 C 14.44 15.43 15.71 14.64 16.99 13.7 C 17.11 13.6 17.28 13.58 17.43 13.63 C 17.5 13.65 17.54 13.73 17.53 13.8 C 17.05 16.53 16.16 19.08 14.84 21.44 C 14.47 22.12 14.01 22.76 13.48 23.34 C 13.33 23.49 13.1 23.53 12.91 23.42 C 12.61 23.25 12.35 22.95 12.15 22.54 C 12.03 22.31 12.04 21.95 12.15 21.43 C 12.5 19.9 12.76 18.2 12.95 16.36 C 12.95 16.23 13.03 16.11 13.16 16.06 Z" fill="#673ae4"/>
        </svg>
        <span className="font-semibold text-lg">Firtal Activity Watch</span>
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
