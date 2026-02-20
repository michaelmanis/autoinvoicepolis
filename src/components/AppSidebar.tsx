import { LayoutDashboard, FileText, LogOut, FolderOpen, UserCheck, FolderCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: FileText, label: "Τιμολόγια", id: "invoices" },
  { icon: FolderOpen, label: "Projects", id: "projects" },
  { icon: FolderCheck, label: "Φάκελος Λογιστή", id: "accountant-folder" },
];

const accountantNavItems = [
  { icon: UserCheck, label: "Έγκριση Λογιστή", id: "accountant" },
];

interface AppSidebarProps {
  collapsed?: boolean;
  activeView: string;
  onNavigate: (view: string) => void;
}

function PendingBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-xs font-bold text-warning-foreground leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function AppSidebar({ collapsed = false, activeView, onNavigate }: AppSidebarProps) {
  const { signOut, user } = useAuth();
  const { isAccountant, isAdmin } = useUserRole();

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["accountant-pending-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("status", "accountant_pending");
      return count ?? 0;
    },
    refetchInterval: 30_000,
    enabled: isAccountant || isAdmin,
  });

  const allItems = [...navItems, ...(isAccountant || isAdmin ? accountantNavItems : [])];

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
        {allItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              activeView === item.id
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
            {!collapsed && item.id === "accountant-folder" && <PendingBadge count={pendingCount} />}
            {collapsed && item.id === "accountant-folder" && pendingCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning" />
            )}
          </button>
        ))}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border px-2 py-4">
        {!collapsed && user && (
          <p className="truncate px-3 text-xs text-sidebar-foreground/50">{user.email}</p>
        )}
        {!collapsed && (isAccountant || isAdmin) && (
          <p className="truncate px-3 text-xs font-medium text-warning">
            {isAdmin ? "👑 Admin" : "📋 Λογιστής"}
          </p>
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
