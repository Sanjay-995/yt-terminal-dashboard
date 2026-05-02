import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout/Layout";
import { OverviewPage } from "@/pages/overview";
import { ChannelPage } from "@/pages/channel";
import { SettingsPage } from "@/pages/settings";
import { LockScreen } from "@/pages/lock-screen";
import { useEffect, useState } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function DarkModeEnforcer() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return null;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={OverviewPage} />
        <Route path="/channels" component={ChannelPage} />
        <Route path="/channels/:channelId" component={ChannelPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem("yt_access") === "1"
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DarkModeEnforcer />
        {unlocked ? (
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        ) : (
          <LockScreen onUnlock={() => setUnlocked(true)} />
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
