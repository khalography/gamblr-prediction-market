import { useWeb3 } from "@/lib/web3";
import { Button } from "@/components/ui/button";
import { DepositModal } from "./deposit-modal";
import { Wallet } from "lucide-react";
import logoUrl from "@assets/Modern Gamblr Logo with Wordmark and Symbol_1764163079687.png";

export function Navbar() {
  const { account, connectWallet, internalBalance, isConnecting } = useWeb3();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="Gamblr Logo" className="h-10 w-auto object-contain" />
        </div>

        <div className="flex items-center gap-4">
          {account ? (
            <>
              <div className="hidden md:flex items-center gap-4 mr-2 text-sm">
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground text-xs uppercase tracking-widest">Balance</span>
                  <span className="font-mono font-bold">{Number(internalBalance).toFixed(2)} USDC</span>
                </div>
              </div>
              
              <DepositModal />
              
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-xs font-mono">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {account.slice(0, 6)}...{account.slice(-4)}
              </div>
            </>
          ) : (
            <Button onClick={connectWallet} disabled={isConnecting}>
              {isConnecting ? "Connecting..." : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
