import { useState } from "react";
import polisLogo from "@/assets/polis-logo.png";
import consultingIcon from "@/assets/consulting.png";
import {
  LayoutDashboard, FileText, LogOut, FolderOpen,
  UserCheck, FolderCheck, ChevronLeft, ChevronRight, Settings, ContactRound, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Nav definitions ──────────────────────────────────────────────────────────

const EMPLOYEE_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard",        id: "dashboard" },
  { icon: FileText,        label: "Τιμολόγια",        id: "invoices" },
  { icon: Receipt,         label: "Δαπάνες",          id: "expenses" },
  { icon: FolderOpen,      label: "Projects",          id: "projects" },
  { icon: ContactRound,    label: "Κάρτες",            id: "business-cards" },
];

const ACCOUNTANT_ITEMS = [
  { icon: FolderCheck,     label: "Φάκελος Λογιστή",  id: "accountant-folder" },
  { icon: UserCheck,       label: "Έγκριση Λογιστή",  id: "accountant" },
];

const ADMIN_ITEMS = [
  { icon: Settings, label: "Ρυθμίσεις", id: "settings" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PendingBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
  if (count === 0) return null;
  const label = count > 99 ? "99+" : String(count);
  if (collapsed) {
    return (
      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-warning-foreground leading-none">
        {label}
      </span>
    );
  }
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-xs font-bold text-warning-foreground leading-none">
      {label}
    </span>
  );
}

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  id: string;
  active: boolean;
  collapsed: boolean;
  badge?: React.ReactNode;
  onClick: () => void;
}

function NavItem({ icon: Icon, label, active, collapsed, badge, onClick }: NavItemProps) {
  const btn = (
    <button
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
        active
          ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
      {badge}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return btn;
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

interface AppSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export default function AppSidebar({ activeView, onNavigate }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
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

  // Accountant-only: sees only accountant items
  // Admin: sees everything
  // Employee/user: sees employee items + accountant folder
  const allItems = isAccountant && !isAdmin
    ? [...ACCOUNTANT_ITEMS]
    : [
        ...EMPLOYEE_ITEMS,
        ...(isAdmin ? ACCOUNTANT_ITEMS : []),
        ...(isAdmin ? ADMIN_ITEMS : []),
      ];

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out overflow-hidden",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Header */}
      {collapsed ? (
        <div className="flex flex-col items-center border-b border-sidebar-border py-3 gap-2">
          <img src={consultingIcon} alt="Polis Analytica" className="h-6 w-6 object-contain brightness-0 invert" />
          <button
            onClick={() => setCollapsed(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
          <img src={polisLogo} alt="Polis Analytica" className="h-12 w-auto object-contain mx-auto brightness-0 invert" />
          <button
            onClick={() => setCollapsed(true)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {allItems.map((item) => (
          <NavItem
            key={item.id}
            {...item}
            active={activeView === item.id}
            collapsed={collapsed}
            onClick={() => onNavigate(item.id)}
            badge={
              item.id === "accountant-folder"
                ? <PendingBadge count={pendingCount} collapsed={collapsed} />
                : undefined
            }
          />
        ))}
      </nav>

      {/* Footer */}
      <div className={cn(
        "space-y-1 border-t border-sidebar-border px-2 py-4",
      )}>
        {!collapsed && user && (
          <p className="truncate px-3 pb-1 text-xs text-sidebar-foreground/50">{user.email}</p>
        )}
        {!collapsed && (isAccountant || isAdmin) && (
          <p className="truncate px-3 pb-1 text-xs font-medium text-warning">
            {isAdmin ? "👑 Admin" : "📋 Λογιστής"}
          </p>
        )}

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed && "justify-center px-2",
              )}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Αποσύνδεση</span>}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="text-xs">Αποσύνδεση</TooltipContent>
          )}
        </Tooltip>

        {!collapsed && (
          <p className="px-3 pt-1 text-xs text-sidebar-foreground/50">
            © 2026 Polis Analytica
          </p>
        )}
      </div>
    </aside>
  );
}
