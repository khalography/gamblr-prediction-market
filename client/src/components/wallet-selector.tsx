import { useState } from "react";
import { useWeb3, WalletProvider } from "@/lib/web3";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Loader2, Mail, ShieldAlert } from "lucide-react";

export function WalletSelector() {
  const { 
    availableWallets, 
    showWalletSelector, 
    setShowWalletSelector, 
    connectWallet, 
    connectCircleWallet, 
    isConnecting 
  } = useWeb3();

  const [username, setUsername] = useState("");

  const handleSelectWallet = async (wallet: WalletProvider) => {
    await connectWallet(wallet);
  };

  const handleCircleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    await connectCircleWallet(username.trim());
  };

  return (
    <Dialog open={showWalletSelector} onOpenChange={setShowWalletSelector}>
      <DialogContent className="sm:max-w-[420px] border border-violet-500/20 bg-slate-950/95 text-slate-100 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
            <Wallet className="h-5 w-5 text-violet-400" />
            Connect Your Wallet
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Log in to Gamblr on Arc Testnet.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          {/* Circle Wallet Email Login Option */}
          <form onSubmit={handleCircleLogin} className="grid gap-3 p-4 rounded-xl border border-violet-500/10 bg-violet-500/5">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-semibold text-violet-300">Fast Web2 Onboarding</span>
            </div>
            
            <div className="grid gap-1.5">
              <Label htmlFor="circle-username" className="text-xs text-slate-400">
                Email Address or Username
              </Label>
              <Input
                id="circle-username"
                type="text"
                placeholder="you@example.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-10 border-slate-800 bg-slate-900 text-white placeholder:text-slate-600 focus-visible:ring-violet-500"
                disabled={isConnecting}
              />
            </div>

            <Button
              type="submit"
              disabled={isConnecting || !username.trim()}
              className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white font-medium shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all hover:scale-[1.01]"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Login with Circle Wallet"
              )}
            </Button>
          </form>

          {/* Separator */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">
              or connect extension
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Browser Wallets list */}
          <div className="grid gap-2">
            {availableWallets.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-900/20 text-slate-500">
                <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-xs">No web3 extensions detected</p>
                <p className="text-[10px] mt-1 text-slate-600">Install MetaMask to use browser wallets</p>
              </div>
            ) : (
              availableWallets.map((wallet) => (
                <Button
                  key={wallet.uuid}
                  variant="outline"
                  className="w-full h-12 justify-start gap-3 border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700 text-slate-300 hover:text-white"
                  onClick={() => handleSelectWallet(wallet)}
                  disabled={isConnecting}
                >
                  {wallet.icon ? (
                    <img 
                      src={wallet.icon} 
                      alt={wallet.name} 
                      className="h-6 w-6 rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-lg bg-slate-800 flex items-center justify-center">
                      <Wallet className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                  )}
                  <span className="font-medium text-sm">{wallet.name}</span>
                  {isConnecting && (
                    <Loader2 className="ml-auto h-4 w-4 animate-spin text-slate-500" />
                  )}
                </Button>
              ))
            )}
          </div>
        </div>
        
        <p className="text-[11px] text-center text-slate-500">
          Security powered by Circle Web3 MPC technology.
        </p>
      </DialogContent>
    </Dialog>
  );
}
