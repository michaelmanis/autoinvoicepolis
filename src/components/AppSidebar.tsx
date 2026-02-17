import { LayoutDashboard, Mail, FileText, Settings, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Mail, label: "Emails", active: false },
  { icon: FileText, label: "Τιμολόγια", active: false },
  { icon: Settings, label: "Ρυθμίσεις", active: false },
  { icon: HelpCircle, label: "Βοήθεια", active: false },
];

interface AppSidebarProps {
  collapsed?: boolean;
}

export default function AppSidebar({ collapsed = false }: AppSidebarProps) {
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
            key={item.label}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              item.active
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-4">
        <p className={cn(
          "text-xs text-sidebar-foreground/50",
          collapsed && "text-center"
        )}>
          {collapsed ? "©" : "© 2026 Polis Analytica"}
        </p>
      </div>
    </aside>
  );
}
