import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Web3Provider, useWeb3 } from "@/lib/web3";
import { MobileNav } from "@/components/mobile-nav";
import { WalletSelector } from "@/components/wallet-selector";
import { Footer } from "@/components/footer";
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

function AppContent() {
  const { isSandbox, walletType, circleUsername } = useWeb3();

  return (
    <div className="min-h-screen flex flex-col">
      {isSandbox && (
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[11px] font-semibold text-center py-1.5 tracking-wider uppercase flex items-center justify-center gap-1.5 px-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)] z-[100]">
          <span>⚡ Sandbox Mode Active</span>
          <span className="opacity-60">•</span>
          <span>Simulated Circle Web3 Wallets</span>
          {walletType === "circle" && circleUsername && (
            <>
              <span className="opacity-60">•</span>
              <span>Logged in as: <strong className="text-yellow-300 font-bold">{circleUsername}</strong></span>
            </>
          )}
        </div>
      )}
      <Router />
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Web3Provider>
          <AppContent />
          <MobileNav />
          <WalletSelector />
        </Web3Provider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
