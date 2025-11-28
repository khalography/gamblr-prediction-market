import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Web3Provider } from "@/lib/web3";
import { MobileNav } from "@/components/mobile-nav";
import Home from "@/pages/home.tsx";
import Admin from "@/pages/admin.tsx";
import Portfolio from "@/pages/portfolio.tsx";
import NotFound from "@/pages/not-found.tsx";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={Admin} />
      <Route path="/portfolio" component={Portfolio} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Web3Provider>
          <Router />
          <MobileNav />
        </Web3Provider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
