import { useState } from "react";
import polisLogo from "@/assets/polis-logo.png";
import AppSidebar from "@/components/AppSidebar";
import PipelineView from "@/components/PipelineView";
import InvoicesPage from "@/pages/InvoicesPage";

const Index = () => {
  const [activeView, setActiveView] = useState("dashboard");

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex-1 overflow-auto">
        <header className="flex items-center justify-between border-b border-border bg-card px-8 py-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Invoice Automation</h1>
            
          </div>
          <img src={polisLogo} alt="Polis Analytica" className="h-16 object-contain" />
        </header>

        <div className="animate-slide-in p-8">
          {activeView === "dashboard" && <PipelineView />}
          {activeView === "invoices" && <InvoicesPage />}
        </div>
      </main>
    </div>);

};

export default Index;