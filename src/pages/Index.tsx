/**
 * Index — Main layout with responsive sidebar (hamburger on mobile).
 */

import { useState, useEffect } from "react";
import AppSidebar from "@/components/AppSidebar";
import PipelineView from "@/components/PipelineView";
import InvoicesPage from "@/pages/InvoicesPage";
import ProjectsPage from "@/pages/ProjectsPage";
import AccountantPage from "@/pages/AccountantPage";
import AccountantFolderPage from "@/pages/AccountantFolderPage";
import SettingsPage from "@/pages/SettingsPage";
import BusinessCardsPage from "@/pages/BusinessCardsPage";
import ExpensesPage from "@/pages/ExpensesPage";
import GlobalSearch from "@/components/GlobalSearch";
import { useUserRole } from "@/hooks/useUserRole";
import { Menu, Search } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const VIEW_MAP: Record<string, React.ComponentType> = {
  dashboard: PipelineView,
  invoices: InvoicesPage,
  expenses: ExpensesPage,
  projects: ProjectsPage,
  accountant: AccountantPage,
  "accountant-folder": AccountantFolderPage,
  settings: SettingsPage,
  "business-cards": BusinessCardsPage,
};

const Index = () => {
  const { isAccountant, isAdmin } = useUserRole();
  const isAccountantOnly = isAccountant && !isAdmin;
  const [activeView, setActiveView] = useState(
    isAccountantOnly ? "accountant-folder" : "dashboard"
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const ActiveComponent = VIEW_MAP[activeView] ?? PipelineView;

  const handleNavigate = (view: string) => {
    setActiveView(view);
    setMobileOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <AppSidebar activeView={activeView} onNavigate={setActiveView} />
      </div>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <AppSidebar activeView={activeView} onNavigate={handleNavigate} />
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-auto">
        {/* Mobile header with hamburger */}
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:px-8 md:py-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold text-foreground md:hidden">DocuHandler</span>
        </header>
        <div className="animate-slide-in p-4 md:p-8">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
};

export default Index;
