/**
 * Index — Main layout page that renders the sidebar and switches between
 * different views based on the active navigation item. Acts as an SPA shell
 * with role-aware default view selection.
 */

import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import PipelineView from "@/components/PipelineView";
import InvoicesPage from "@/pages/InvoicesPage";
import ProjectsPage from "@/pages/ProjectsPage";
import AccountantPage from "@/pages/AccountantPage";
import AccountantFolderPage from "@/pages/AccountantFolderPage";
import SettingsPage from "@/pages/SettingsPage";
import { useUserRole } from "@/hooks/useUserRole";

/** Maps view IDs to their components */
const VIEW_MAP: Record<string, React.ComponentType> = {
  dashboard: PipelineView,
  invoices: InvoicesPage,
  projects: ProjectsPage,
  accountant: AccountantPage,
  "accountant-folder": AccountantFolderPage,
  settings: SettingsPage,
};

const Index = () => {
  const { isAccountant, isAdmin } = useUserRole();
  const isAccountantOnly = isAccountant && !isAdmin;

  // Accountant-only users default to their folder view
  const [activeView, setActiveView] = useState(
    isAccountantOnly ? "accountant-folder" : "dashboard"
  );

  const ActiveComponent = VIEW_MAP[activeView] ?? PipelineView;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex-1 overflow-auto">
        <header className="flex items-center border-b border-border bg-card px-8 py-4">
          <h1 className="text-xl font-semibold text-foreground">DocuHandler</h1>
        </header>
        <div className="animate-slide-in p-8">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
};

export default Index;
