import { useState } from "react";
import { useWeb3 } from "@/lib/web3";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ethers } from "ethers";
import { Loader2 } from "lucide-react";

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  marketId: number;
  question: string;
  isYes: boolean;
}

export function BetModal({ isOpen, onClose, marketId, question, isYes }: BetModalProps) {
  const { getContract, internalBalance, refreshBalances } = useWeb3();
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleBet = async () => {
    const contract = getContract();
    if (!contract || !amount) return;

    setIsLoading(true);
    try {
      const parsedAmount = ethers.parseUnits(amount, 6); // 6 decimals for internal ledger too
      
      // placeBet(marketId, isYes, amount)
      const tx = await contract.placeBet(marketId, isYes, parsedAmount);
      await tx.wait();

      toast({
        title: "Bet Placed!",
        description: `You bet ${amount} USDC on ${isYes ? "YES" : "NO"}.`,
      });
      
      setAmount("");
      onClose();
      await refreshBalances();

    } catch (error: any) {
      console.error(error);
      toast({
        title: "Bet Failed",
        description: error.message || "Transaction failed",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Place Bet</DialogTitle>
          <DialogDescription>
            {question}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
             <span className="font-medium">Prediction</span>
             <span className={`font-bold ${isYes ? "text-primary" : "text-red-500"}`}>
               {isYes ? "YES" : "NO"}
             </span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bet-amount">Stake Amount (USDC)</Label>
            <Input
              id="bet-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10"
              type="number"
            />
            <p className="text-xs text-muted-foreground">
              Available Balance: {Number(internalBalance).toFixed(2)} USDC
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleBet} 
            disabled={isLoading || !amount}
            className={isYes ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-red-600 hover:bg-red-700"}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Place Bet"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
