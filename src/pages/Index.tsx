import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import PipelineView from "@/components/PipelineView";
import InvoicesPage from "@/pages/InvoicesPage";
import ProjectsPage from "@/pages/ProjectsPage";
import AccountantPage from "@/pages/AccountantPage";
import AccountantFolderPage from "@/pages/AccountantFolderPage";
import SettingsPage from "@/pages/SettingsPage";
import { useUserRole } from "@/hooks/useUserRole";

const Index = () => {
  const { isAccountant, isAdmin } = useUserRole();
  const isAccountantOnly = isAccountant && !isAdmin;
  const [activeView, setActiveView] = useState(isAccountantOnly ? "accountant-folder" : "dashboard");

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex-1 overflow-auto">
        <header className="flex items-center border-b border-border bg-card px-8 py-4">
          <h1 className="text-xl font-semibold text-foreground">DocuHandler</h1>
        </header>

        <div className="animate-slide-in p-8">
          {activeView === "dashboard"         && <PipelineView />}
          {activeView === "invoices"          && <InvoicesPage />}
          {activeView === "projects"          && <ProjectsPage />}
          {activeView === "accountant"        && <AccountantPage />}
          {activeView === "accountant-folder" && <AccountantFolderPage />}
          {activeView === "settings"          && <SettingsPage />}
        </div>
      </main>
    </div>
  );
};

export default Index;

