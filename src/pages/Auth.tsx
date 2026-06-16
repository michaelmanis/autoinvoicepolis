import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png.asset.json";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        toast({
          title: "Εγγραφή επιτυχής",
          description: "Ελέγξτε το email σας για επιβεβαίωση."
        });
      }
    } catch (error: any) {
      toast({
        title: "Σφάλμα",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <img src={logo.url} alt="DocuHandler Logo" className="h-16 w-auto object-contain brightness-0" />
          <h1 className="text-2xl font-semibold text-foreground">​DocuHandler</h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Συνδεθείτε στο λογαριασμό σας" : "Δημιουργήστε νέο λογαριασμό"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required />

          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Κωδικός</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6} />

          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Παρακαλώ περιμένετε..." : isLogin ? "Σύνδεση" : "Εγγραφή"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ή</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              const demoEmail = `demo_${Date.now()}@demo.invoice-automation.app`;
              const demoPass = crypto.randomUUID();
              const { error } = await supabase.auth.signUp({ email: demoEmail, password: demoPass });
              if (error) throw error;
              // auto-confirm is enabled, so sign in immediately
              const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPass });
              if (loginErr) throw loginErr;
              // Seed demo data in background
              supabase.functions.invoke("seed-demo-data", {
                headers: loginData.session?.access_token
                  ? { Authorization: `Bearer ${loginData.session.access_token}` }
                  : undefined,
              }).catch(console.error);
              navigate("/");
            } catch (error: any) {
              toast({ title: "Σφάλμα", description: error.message, variant: "destructive" });
            } finally {
              setLoading(false);
            }
          }}>

          🚀 Είσοδος ως Demo
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? "Δεν έχετε λογαριασμό;" : "Έχετε ήδη λογαριασμό;"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="font-medium text-primary underline-offset-4 hover:underline">

            {isLogin ? "Εγγραφή" : "Σύνδεση"}
          </button>
        </p>
      </div>
    </div>);

}