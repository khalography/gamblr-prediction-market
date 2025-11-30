import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BetModal } from "./bet-modal";
import { Clock, TrendingUp, Users, Database } from "lucide-react";
import { format } from "date-fns";
import { ethers } from "ethers";

export interface Market {
  id: number;
  question: string;
  totalYes: string; // in standard units (string)
  totalNo: string;
  endTime: number; // unix timestamp
  resolved: boolean;
  outcome: number; // 0 pending, 1 yes, 2 no, 3 void
  oracle?: string; // Oracle data source for settlement
  isOnChain?: boolean; // Whether this market exists on the smart contract
}

export function MarketCard({ market }: { market: Market }) {
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<boolean>(true);

  const totalYes = parseFloat(market.totalYes);
  const totalNo = parseFloat(market.totalNo);
  const totalPool = totalYes + totalNo;
  
  // Calculate percentages (defaults to 50/50 if empty)
  const yesPercent = totalPool > 0 ? (totalYes / totalPool) * 100 : 50;
  const noPercent = 100 - yesPercent;

  const handleBet = (isYes: boolean) => {
    setSelectedSide(isYes);
    setBetModalOpen(true);
  };

  const isEnded = Date.now() / 1000 > market.endTime;
  const isPreview = market.isOnChain === false;

  return (
    <>
      <Card className="w-full hover:border-primary/50 transition-colors duration-300 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start gap-4">
            <CardTitle className="text-xl leading-tight font-display">{market.question}</CardTitle>
            {isPreview ? (
              <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-500/10 text-yellow-500 uppercase tracking-wider">
                Coming Soon
              </span>
            ) : isEnded ? (
              <span className="px-2 py-1 rounded text-xs font-bold bg-muted text-muted-foreground uppercase tracking-wider">
                Ended
              </span>
            ) : (
              <span className="px-2 py-1 rounded text-xs font-bold bg-primary/10 text-primary uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Live
              </span>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pb-4">
          <div className="flex justify-between text-sm mb-2 font-medium">
            <span className="text-primary">{yesPercent.toFixed(1)}% YES</span>
            <span className="text-red-500">{noPercent.toFixed(1)}% NO</span>
          </div>
          <Progress value={yesPercent} className="h-3 bg-red-500/20 [&>div]:bg-primary" />
          
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>${totalPool.toFixed(2)} Vol</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Ends {format(new Date(market.endTime * 1000), "MMM d, yyyy 'at' h:mm a")}</span>
            </div>
            {market.oracle && (
              <div className="flex items-center gap-1 text-primary/80">
                <Database className="w-3 h-3" />
                <span>{market.oracle}</span>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="grid grid-cols-2 gap-3 pt-0">
          {isPreview ? (
            <div className="col-span-2 text-center py-2 text-sm text-muted-foreground border border-dashed rounded-md">
              Market not yet deployed on-chain
            </div>
          ) : (
            <>
              <Button 
                variant="outline" 
                className="border-primary/30 hover:bg-primary/10 hover:text-primary hover:border-primary"
                onClick={() => handleBet(true)}
                disabled={isEnded}
              >
                Bet YES
              </Button>
              <Button 
                variant="outline" 
                className="border-red-500/30 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500"
                onClick={() => handleBet(false)}
                disabled={isEnded}
              >
                Bet NO
              </Button>
            </>
          )}
        </CardFooter>
      </Card>

      <BetModal 
        isOpen={betModalOpen} 
        onClose={() => setBetModalOpen(false)}
        marketId={market.id}
        question={market.question}
        isYes={selectedSide}
      />
    </>
  );
}
