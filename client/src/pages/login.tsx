import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldCheck } from "lucide-react";
import logo from "@assets/generated_images/minimalist_legal_logo_navy_gold.png";

export default function LoginPage() {
  const { user, login, register, loading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("redirect") || "/";
  }, []);

  useEffect(() => {
    if (!loading && user) {
      setLocation(redirectTo);
    }
  }, [loading, user, redirectTo, setLocation]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
      toast({
        title: mode === "login" ? "Welcome back" : "Account created",
        description: "Authentication successful.",
      });
      setLocation(redirectTo);
    } catch (err: any) {
      const message =
        typeof err?.message === "string"
          ? err.message.replace(/^\d+:\s*/, "")
          : "Authentication failed.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-border/60">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center p-1">
              <img src={logo} alt="CaseBuddy Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <CardTitle className="font-serif text-2xl text-primary">CaseBuddy</CardTitle>
              <CardDescription className="text-xs uppercase tracking-wider">
                Secure Legal Workspace
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            Access requires authenticated credentials.
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="e.g., jsmith"
                disabled={submitting}
                data-testid="input-login-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                disabled={submitting}
                data-testid="input-login-password"
              />
            </div>
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter password"
                  disabled={submitting}
                  data-testid="input-login-confirm-password"
                />
              </div>
            )}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {mode === "login" ? "Signing in" : "Creating account"}
                </>
              ) : mode === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Need access?{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setMode("register")}
                  data-testid="button-switch-register"
                >
                  Create the first account
                </button>
              </>
            ) : (
              <>
                Already have access?{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setMode("login")}
                  data-testid="button-switch-login"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
