import { useState } from "react";
import { useWeb3 } from "@/lib/web3";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ethers } from "ethers";
import { Loader2, ArrowUpFromLine } from "lucide-react";

export function WithdrawModal() {
  const { getContract, refreshBalances, internalBalance } = useWeb3();
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleWithdraw = async () => {
    const contract = getContract();
    if (!contract || !amount) return;

    setIsLoading(true);
    try {
      const parsedAmount = ethers.parseUnits(amount, 6);

      const tx = await contract.withdraw(parsedAmount);
      await tx.wait();

      toast({
        title: "Withdrawal Successful",
        description: `Withdrew ${amount} USDC to your wallet.`,
        variant: "default"
      });
      
      setAmount("");
      setIsOpen(false);
      await refreshBalances();

    } catch (error: any) {
      console.error(error);
      toast({
        title: "Withdrawal Failed",
        description: error.reason || error.message || "Transaction failed",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaxClick = () => {
    setAmount(internalBalance);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/10 hover:text-primary" data-testid="button-withdraw">
          <ArrowUpFromLine className="h-4 w-4" />
          Withdraw
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Withdraw USDC</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="withdraw-amount">Amount (USDC)</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="withdraw-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="col-span-3"
                data-testid="input-withdraw-amount"
              />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleMaxClick}
                className="text-primary hover:text-primary/80"
                data-testid="button-max-withdraw"
              >
                MAX
              </Button>
            </div>
            <p className="text-xs text-foreground">
              Available Balance: {Number(internalBalance).toFixed(2)} USDC
            </p>
          </div>
        </div>
        <Button 
          onClick={handleWithdraw} 
          disabled={isLoading || !amount || Number(amount) > Number(internalBalance)} 
          className="w-full"
          data-testid="button-confirm-withdraw"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Withdraw"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
