import polisLogo from "@/assets/polis-logo.png";
import AppSidebar from "@/components/AppSidebar";
import PipelineView from "@/components/PipelineView";

const Index = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border bg-card px-8 py-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Invoice Automation</h1>
            <p className="text-sm text-muted-foreground">Email → OCR → Shipment → Invoice → ERP → myDATA</p>
          </div>
          <img src={polisLogo} alt="Polis Analytica" className="h-10 object-contain" />
        </header>

        {/* Content */}
        <div className="animate-slide-in p-8">
          <PipelineView />
        </div>
      </main>
    </div>
  );
};

export default Index;
