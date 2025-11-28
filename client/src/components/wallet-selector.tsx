import { useWeb3, WalletProvider } from "@/lib/web3";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Loader2 } from "lucide-react";

export function WalletSelector() {
  const { availableWallets, showWalletSelector, setShowWalletSelector, connectWallet, isConnecting } = useWeb3();

  const handleSelectWallet = async (wallet: WalletProvider) => {
    await connectWallet(wallet);
  };

  return (
    <Dialog open={showWalletSelector} onOpenChange={setShowWalletSelector}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Select Wallet
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-2 py-4">
          {availableWallets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No wallets detected</p>
              <p className="text-sm mt-2">Please install a Web3 wallet extension</p>
            </div>
          ) : (
            availableWallets.map((wallet) => (
              <Button
                key={wallet.uuid}
                variant="outline"
                className="w-full h-14 justify-start gap-3 hover:bg-primary/5 hover:border-primary/30"
                onClick={() => handleSelectWallet(wallet)}
                disabled={isConnecting}
                data-testid={`wallet-option-${wallet.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {wallet.icon ? (
                  <img 
                    src={wallet.icon} 
                    alt={wallet.name} 
                    className="h-8 w-8 rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-4 w-4 text-primary" />
                  </div>
                )}
                <span className="font-medium">{wallet.name}</span>
                {isConnecting && (
                  <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                )}
              </Button>
            ))
          )}
        </div>
        
        <p className="text-xs text-center text-muted-foreground">
          Select a wallet to connect to Gamblr on Arc Testnet
        </p>
      </DialogContent>
    </Dialog>
  );
}
