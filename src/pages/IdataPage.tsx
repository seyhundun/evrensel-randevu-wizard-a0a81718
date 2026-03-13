import IdataControlPanel from "@/components/IdataControlPanel";
import IdataAccounts from "@/components/IdataAccounts";
import IdataTrackingLogs from "@/components/IdataTrackingLogs";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const IdataPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            VFS Global
          </Link>
        </Button>
        <div className="h-5 w-px bg-border" />
        <h1 className="text-lg font-semibold">🇮🇹 iDATA İtalya</h1>
      </header>

      <main className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        <IdataControlPanel />
        <IdataAccounts />
        <IdataTrackingLogs />
      </main>
    </div>
  );
};

export default IdataPage;
