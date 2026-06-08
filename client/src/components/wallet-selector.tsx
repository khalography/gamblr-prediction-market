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
    connectCircleSocialWallet,
    isConnecting,
    isSandbox
  } = useWeb3();

  const [username, setUsername] = useState("");
  const [showSandboxGoogle, setShowSandboxGoogle] = useState(false);
  const [sandboxGoogleEmail, setSandboxGoogleEmail] = useState("");

  const handleSelectWallet = async (wallet: WalletProvider) => {
    await connectWallet(wallet);
  };

  const handleCircleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    await connectCircleWallet(username.trim());
  };

  const handleGoogleLoginClick = async () => {
    if (isSandbox) {
      setShowSandboxGoogle(true);
    } else {
      await connectCircleSocialWallet("google");
    }
  };

  const handleSandboxGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxGoogleEmail.trim()) return;
    await connectCircleSocialWallet("google", sandboxGoogleEmail.trim());
    setShowSandboxGoogle(false);
  };

  return (
    <Dialog open={showWalletSelector} onOpenChange={(open) => {
      setShowWalletSelector(open);
      if (!open) {
        setShowSandboxGoogle(false);
      }
    }}>
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
          {showSandboxGoogle ? (
            <form onSubmit={handleSandboxGoogleSubmit} className="grid gap-3 p-4 rounded-xl border border-violet-500/10 bg-violet-500/5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 mb-1">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-sm font-semibold text-white">Google Sandbox Selection</span>
              </div>
              
              <div className="grid gap-1.5">
                <Label htmlFor="sandbox-email" className="text-xs text-slate-400">
                  Google Account Email (Mock)
                </Label>
                <Input
                  id="sandbox-email"
                  type="email"
                  placeholder="user@gmail.com"
                  value={sandboxGoogleEmail}
                  onChange={(e) => setSandboxGoogleEmail(e.target.value)}
                  className="h-10 border-slate-800 bg-slate-900 text-white placeholder:text-slate-600 focus-visible:ring-violet-500"
                  disabled={isConnecting}
                  required
                />
              </div>

              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowSandboxGoogle(false)}
                  className="flex-1 h-10 border border-slate-800 text-slate-400 hover:text-white"
                  disabled={isConnecting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-10 bg-violet-600 hover:bg-violet-700 text-white font-medium shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                  disabled={isConnecting}
                >
                  Confirm
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid gap-3 p-4 rounded-xl border border-violet-500/10 bg-violet-500/5">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-violet-400" />
                <span className="text-sm font-semibold text-violet-300">Fast Web2 Onboarding</span>
              </div>

              {/* Sign in with Google Button */}
              <Button
                type="button"
                onClick={handleGoogleLoginClick}
                disabled={isConnecting}
                className="w-full h-10 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 hover:border-slate-300 font-semibold flex items-center justify-center gap-2.5 transition-all shadow-sm rounded-lg hover:scale-[1.01]"
              >
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </Button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-violet-500/10"></div>
                <span className="flex-shrink mx-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  or email address
                </span>
                <div className="flex-grow border-t border-violet-500/10"></div>
              </div>
              
              <form onSubmit={handleCircleLogin} className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="circle-username" className="text-[10px] text-slate-400">
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
            </div>
          )}

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
