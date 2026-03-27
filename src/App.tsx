import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";

import Home from "@/pages/Home";
import VoltageDrop from "@/pages/VoltageDrop";
import FiberBudget from "@/pages/FiberBudget";
import InrushCurrent from "@/pages/InrushCurrent";
import History from "@/pages/History";
import FireAlarm from "@/pages/FireAlarm";
import CCTV from "@/pages/CCTV";
import Telephone from "@/pages/Telephone";
import PA from "@/pages/PA";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/voltage-drop" component={VoltageDrop} />
        <Route path="/fiber-budget" component={FiberBudget} />
        <Route path="/inrush-current" component={InrushCurrent} />
        <Route path="/history" component={History} />
        <Route path="/fire-alarm" component={FireAlarm} />
        <Route path="/cctv" component={CCTV} />
        <Route path="/telephone" component={Telephone} />
        <Route path="/pa" component={PA} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
