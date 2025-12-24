import { useEffect, type ComponentType } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SaveStatusProvider } from "@/hooks/use-save-status";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import CaseView from "@/pages/case-view";
import MyCases from "@/pages/my-cases";
import CalendarPage from "@/pages/calendar";
import ResearchPage from "@/pages/research";
import SettingsPage from "@/pages/settings";
import TrialPrepPage from "@/pages/trial-prep";
import LoginPage from "@/pages/login";
import LandingPage from "@/pages/landing";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  const shouldRedirect = !loading && !user && location !== "/login";

  useEffect(() => {
    if (shouldRedirect) {
      const redirect = encodeURIComponent(location);
      setLocation(`/login?redirect=${redirect}`);
    }
  }, [shouldRedirect, location, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Checking session...</div>
      </div>
    );
  }

  if (shouldRedirect || !user) return null;

  return <>{children}</>;
}

function ProtectedRoute({ component: Component, path }: { component: ComponentType; path: string }) {
  return (
    <Route path={path}>
      <RequireAuth>
        <Component />
      </RequireAuth>
    </Route>
  );
}

function Router() {
  const [location] = useLocation();
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <ProtectedRoute path="/app" component={Dashboard} />
      <ProtectedRoute path="/app/cases" component={MyCases} />
      <ProtectedRoute path="/app/trial-prep" component={TrialPrepPage} />
      <ProtectedRoute path="/app/calendar" component={CalendarPage} />
      <ProtectedRoute path="/app/research" component={ResearchPage} />
      <ProtectedRoute path="/app/settings" component={SettingsPage} />
      <ProtectedRoute path="/app/case/:id" component={CaseView} />
      <Route>
        {location.startsWith("/app") ? (
          <RequireAuth>
            <NotFound />
          </RequireAuth>
        ) : (
          <NotFound />
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SaveStatusProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </SaveStatusProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
