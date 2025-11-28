import { useState } from "react";
import { useWeb3 } from "@/lib/web3";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ethers } from "ethers";
import { GAMBLR_ADDRESS } from "@/lib/gamblr-abi";
import { Loader2, Wallet } from "lucide-react";

export function DepositModal() {
  const { getContract, getUsdcContract, account, refreshBalances, walletBalance } = useWeb3();
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleDeposit = async () => {
    const contract = getContract();
    const usdcContract = getUsdcContract();
    if (!contract || !usdcContract || !amount) return;

    setIsLoading(true);
    try {
      const parsedAmount = ethers.parseUnits(amount, 6); // USDC has 6 decimals

      // Check allowance
      const allowance = await usdcContract.allowance(account, GAMBLR_ADDRESS);
      
      if (allowance < parsedAmount) {
        toast({ title: "Approving USDC...", description: "Please confirm the approval transaction." });
        const approveTx = await usdcContract.approve(GAMBLR_ADDRESS, parsedAmount);
        await approveTx.wait();
        toast({ title: "Approved!", description: "Now confirming deposit..." });
      }

      const tx = await contract.deposit(parsedAmount);
      await tx.wait();

      toast({
        title: "Deposit Successful",
        description: `Deposited ${amount} USDC to your Gamblr balance.`,
        variant: "default" // Success styling
      });
      
      setAmount("");
      setIsOpen(false);
      await refreshBalances();

    } catch (error: any) {
      console.error(error);
      toast({
        title: "Deposit Failed",
        description: error.message || "Transaction failed",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/10 hover:text-primary">
          <Wallet className="h-4 w-4" />
          Deposit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deposit USDC</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount (USDC)</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="col-span-3"
              />
              <span className="text-sm font-bold text-muted-foreground">USDC</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Wallet Balance: {Number(walletBalance).toFixed(2)} USDC
            </p>
          </div>
        </div>
        <Button onClick={handleDeposit} disabled={isLoading || !amount} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Deposit"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
