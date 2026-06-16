import { useState } from "react";
import {
  LayoutDashboard, FileText, LogOut, FolderOpen,
  UserCheck, FolderCheck, ChevronLeft, ChevronRight, Settings, ContactRound, Receipt } from
"lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import logo from "@/assets/logo.png.asset.json";
import logoIcon from "@/assets/logo-icon.png.asset.json";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from
"@/components/ui/select";

const EMPLOYEE_ITEMS = [
{ icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
{ icon: FileText, label: "Τιμολόγια", id: "invoices" },
{ icon: Receipt, label: "Δαπάνες", id: "expenses" },
{ icon: FolderOpen, label: "Projects", id: "projects" },
{ icon: ContactRound, label: "Κάρτες", id: "business-cards" }];


const ACCOUNTANT_ITEMS = [
{ icon: FolderCheck, label: "Φάκελος Λογιστή", id: "accountant-folder" },
{ icon: UserCheck, label: "Έγκριση Λογιστή", id: "accountant" }];


const ADMIN_ITEMS = [
{ icon: Settings, label: "Ρυθμίσεις", id: "settings" }];


function PendingBadge({ count, collapsed }: {count: number;collapsed: boolean;}) {
  if (count === 0) return null;
  const label = count > 99 ? "99+" : String(count);
  if (collapsed) {
    return (
      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-warning-foreground leading-none">
        {label}
      </span>);

  }
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-xs font-bold text-warning-foreground leading-none">
      {label}
    </span>);

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
  const btn =
  <button
    onClick={onClick}
    className={cn(
      "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
      active ?
      "bg-sidebar-accent text-sidebar-primary shadow-sm" :
      "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      collapsed && "justify-center px-2"
    )}>
    
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
      {badge}
    </button>;


  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
      </Tooltip>);

  }
  return btn;
}

function CompanySelector() {
  const { companies, selectedCompanyId, setSelectedCompanyId } = useCompanyFilter();

  return (
    <div className="px-3 py-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">Εταιρεια</p>
      <Select
        value={selectedCompanyId ?? "all"}
        onValueChange={(v) => setSelectedCompanyId(v === "all" ? null : v)}>
        
        <SelectTrigger className="h-8 text-xs bg-sidebar-accent/50 border-sidebar-border">
          <SelectValue placeholder="Όλες" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Όλες οι εταιρείες</SelectItem>
          {companies.map((c) =>
          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>);

}

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
      const { count: invCount } = await supabase.
      from("invoices").
      select("id", { count: "exact", head: true }).
      eq("status", "accountant_pending");
      const { count: expCount } = await supabase.
      from("expenses").
      select("id", { count: "exact", head: true }).
      eq("status", "accountant_pending");
      return (invCount ?? 0) + (expCount ?? 0);
    },
    refetchInterval: 30_000,
    enabled: isAccountant || isAdmin
  });

  const allItems = isAccountant && !isAdmin ?
  [...ACCOUNTANT_ITEMS] :
  [
  ...EMPLOYEE_ITEMS,
  ...(isAdmin ? ACCOUNTANT_ITEMS : []),
  ...(isAdmin ? ADMIN_ITEMS : [])];


  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out overflow-hidden",
        collapsed ? "w-16" : "w-60"
      )}>
      
      {/* Header — hide collapse toggle on mobile (sidebar is in a sheet) */}
      {collapsed ?
      <div className="flex flex-col items-center border-b border-sidebar-border py-3 gap-2">
          <img src={logoIcon.url} alt="DocuHandler" className="h-8 w-8" />
          <button
          onClick={() => setCollapsed(false)}
          className="hidden md:flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label="Expand sidebar">
          
            <ChevronRight className="h-4 w-4" />
          </button>
        </div> :

      <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-8 w-8 brightness-0 invert" />
            <span className="text-lg font-semibold text-sidebar-foreground">DocuHandler</span>
          </div>
          <button
          onClick={() => setCollapsed(true)}
          className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label="Collapse sidebar">
          
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      }

      {/* Company filter for admins */}
      {isAdmin && !collapsed &&
      <CompanySelector />
      }

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {allItems.map((item) =>
        <NavItem
          key={item.id}
          {...item}
          active={activeView === item.id}
          collapsed={collapsed}
          onClick={() => onNavigate(item.id)}
          badge={
          item.id === "accountant-folder" ?
          <PendingBadge count={pendingCount} collapsed={collapsed} /> :
          undefined
          } />

        )}
      </nav>

      {/* Footer */}
      <div className="space-y-1 border-t border-sidebar-border px-2 py-4">
        {user && (
          collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center pb-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase">
                    {user.email?.charAt(0) ?? "?"}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                <p className="font-medium">{user.email}</p>
                {(isAdmin || isAccountant) && (
                  <p className="text-warning">{isAdmin ? "Admin" : "Λογιστής"}</p>
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2.5 px-2 pb-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase">
                {user.email?.charAt(0) ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-sidebar-foreground">{user.email}</p>
                {(isAdmin || isAccountant) && (
                  <p className="text-[11px] font-medium text-warning">
                    {isAdmin ? "👑 Admin" : "📋 Λογιστής"}
                  </p>
                )}
              </div>
            </div>
          )
        )}

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )}>
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Αποσύνδεση</span>}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="text-xs">Αποσύνδεση</TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>);

}