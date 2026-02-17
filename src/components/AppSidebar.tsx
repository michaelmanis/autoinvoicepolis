import { useState } from "react";
import { LayoutDashboard, FileText, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: FileText, label: "Τιμολόγια", id: "invoices" },
];

interface AppSidebarProps {
  collapsed?: boolean;
  activeView: string;
  onNavigate: (view: string) => void;
}

export default function AppSidebar({ collapsed = false, activeView, onNavigate }: AppSidebarProps) {
  const { signOut, user } = useAuth();

  return (
    <aside className={cn(
      "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all",
      collapsed ? "w-16" : "w-60"
    )}>
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-5">
        {!collapsed && (
          <span className="text-sm font-semibold tracking-wide text-sidebar-foreground">
            Invoice Automation
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              activeView === item.id
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border px-2 py-4">
        {!collapsed && user && (
          <p className="truncate px-3 text-xs text-sidebar-foreground/50">{user.email}</p>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Αποσύνδεση</span>}
        </button>
        <p className={cn("px-3 text-xs text-sidebar-foreground/50", collapsed && "text-center")}>
          {collapsed ? "©" : "© 2026 Polis Analytica"}
        </p>
      </div>
    </aside>
  );
}
