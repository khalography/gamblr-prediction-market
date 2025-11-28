import { useWeb3 } from "@/lib/web3";
import { Button } from "@/components/ui/button";
import { DepositModal } from "./deposit-modal";
import { Wallet, Shield, LogOut, PieChart } from "lucide-react";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoUrl from "@assets/Modern Gamblr Logo with Wordmark and Symbol_1764163079687.png";

export function Navbar() {
  const { account, connectWallet, disconnectWallet, internalBalance, isConnecting, isOwner } = useWeb3();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 cursor-pointer" data-testid="link-home">
          <img src={logoUrl} alt="Gamblr Logo" className="h-10 w-auto object-contain" />
        </Link>

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
              
              <Link href="/portfolio">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary" data-testid="link-portfolio">
                  <PieChart className="h-4 w-4 mr-1" />
                  Portfolio
                </Button>
              </Link>
              
              {isOwner && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10" data-testid="link-admin">
                    <Shield className="h-4 w-4 mr-1" />
                    Admin
                  </Button>
                </Link>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-xs font-mono hover:bg-muted/80 transition-colors cursor-pointer" data-testid="button-wallet-menu">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    {account.slice(0, 6)}...{account.slice(-4)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={disconnectWallet} className="text-red-500 focus:text-red-500 cursor-pointer" data-testid="button-disconnect">
                    <LogOut className="mr-2 h-4 w-4" />
                    Disconnect Wallet
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button onClick={() => connectWallet()} disabled={isConnecting}>
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
