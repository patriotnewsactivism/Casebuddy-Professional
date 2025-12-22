import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SaveStatusProvider } from "@/hooks/use-save-status";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import CaseView from "@/pages/case-view";
import MyCases from "@/pages/my-cases";
import CalendarPage from "@/pages/calendar";
import ResearchPage from "@/pages/research";
import SettingsPage from "@/pages/settings";
import TrialPrepPage from "@/pages/trial-prep";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/cases" component={MyCases} />
      <Route path="/trial-prep" component={TrialPrepPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/research" component={ResearchPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/case/:id" component={CaseView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SaveStatusProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </SaveStatusProvider>
    </QueryClientProvider>
  );
}

export default App;
