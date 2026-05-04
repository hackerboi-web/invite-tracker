import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import ServerList from "@/pages/dashboard/server-list";
import Overview from "@/pages/dashboard/overview";
import Leaderboard from "@/pages/dashboard/leaderboard";
import Members from "@/pages/dashboard/members";
import Settings from "@/pages/dashboard/settings";
import Premium from "@/pages/dashboard/premium";
import UserDetail from "@/pages/dashboard/user-detail";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, error } = useGetMe({ query: { retry: false } });
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && error) {
      setLocation("/");
    }
  }, [isLoading, error, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !user) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      
      <Route path="/dashboard*">
        <AuthGuard>
          <Switch>
            <Route path="/dashboard" component={ServerList} />
            <Route path="/dashboard/:guildId" component={Overview} />
            <Route path="/dashboard/:guildId/leaderboard" component={Leaderboard} />
            <Route path="/dashboard/:guildId/members" component={Members} />
            <Route path="/dashboard/:guildId/settings" component={Settings} />
            <Route path="/dashboard/:guildId/premium" component={Premium} />
            <Route path="/dashboard/:guildId/user/:userId" component={UserDetail} />
            <Route component={NotFound} />
          </Switch>
        </AuthGuard>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
