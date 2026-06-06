import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BetModal } from "./bet-modal";
import { Clock, TrendingUp, Database } from "lucide-react";
import { format } from "date-fns";
import { Market } from "./market-card";

export interface SportsMatch {
  id: string; // sportsEvent.id (UUID)
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string; // ISO date string
  status: string; // "NS", "FT", etc.
  homeScore: number | null;
  awayScore: number | null;
  homeMarket: Market | null;
  drawMarket: Market | null;
  awayMarket: Market | null;
}

export function SportsCard({ match }: { match: SportsMatch }) {
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [selectedMarketId, setSelectedMarketId] = useState<number>(0);
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [selectedOutcomeName, setSelectedOutcomeName] = useState("");

  const homeYes = match.homeMarket ? parseFloat(match.homeMarket.totalYes) : 0;
  const drawYes = match.drawMarket ? parseFloat(match.drawMarket.totalYes) : 0;
  const awayYes = match.awayMarket ? parseFloat(match.awayMarket.totalYes) : 0;

  const totalYesPool = homeYes + drawYes + awayYes;

  // Calculate percentages (defaults to 33.3% each if empty)
  let homePercent = 33.3;
  let awayPercent = 33.3;
  let drawPercent = 33.3;

  if (totalYesPool > 0) {
    homePercent = (homeYes / totalYesPool) * 100;
    awayPercent = (awayYes / totalYesPool) * 100;
    drawPercent = 100 - homePercent - awayPercent;
  }

  // Calculate total volume (YES + NO pools for all 3 markets)
  const homePool = match.homeMarket ? (parseFloat(match.homeMarket.totalYes) + parseFloat(match.homeMarket.totalNo)) : 0;
  const drawPool = match.drawMarket ? (parseFloat(match.drawMarket.totalYes) + parseFloat(match.drawMarket.totalNo)) : 0;
  const awayPool = match.awayMarket ? (parseFloat(match.awayMarket.totalYes) + parseFloat(match.awayMarket.totalNo)) : 0;
  const totalVolume = homePool + drawPool + awayPool;

  const formattedVolume = totalVolume >= 1000 
    ? `$${(totalVolume / 1000).toFixed(0)}K Vol.` 
    : `$${totalVolume.toFixed(2)} Vol.`;

  const isEnded = match.status === "FT" || (Date.now() > new Date(match.matchDate).getTime());

  const handleBetClick = (market: Market | null, outcomeLabel: string) => {
    if (!market || isEnded) return;
    setSelectedMarketId(market.id);
    setSelectedQuestion(market.question);
    setSelectedOutcomeName(outcomeLabel);
    setBetModalOpen(true);
  };

  const getShortName = (name: string) => {
    if (name.length <= 10) return name;
    // Special abbreviation handling for common long country/team names
    if (name === "South Africa") return "South";
    return name.split(" ")[0];
  };

  // Determine winning outcome for highlights
  let winningOutcome: "home" | "draw" | "away" | null = null;
  if (match.status === "FT" && match.homeScore !== null && match.awayScore !== null) {
    if (match.homeScore > match.awayScore) {
      winningOutcome = "home";
    } else if (match.awayScore > match.homeScore) {
      winningOutcome = "away";
    } else {
      winningOutcome = "draw";
    }
  }

  return (
    <>
      <Card className="w-full hover:border-primary/50 transition-all duration-300 bg-card/40 backdrop-blur-md border border-border/40 overflow-hidden shadow-lg p-5">
        <CardContent className="p-0 space-y-5">
          {/* Team Names and Probability Percentages */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-base font-semibold">
              <span className="text-foreground/90">{match.homeTeam}</span>
              <span className="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                {match.status === "FT" && match.homeScore !== null ? `${match.homeScore} | ` : ""}
                {homePercent.toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-base font-semibold">
              <span className="text-foreground/90">{match.awayTeam}</span>
              <span className="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                {match.status === "FT" && match.awayScore !== null ? `${match.awayScore} | ` : ""}
                {awayPercent.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Three outcome buttons */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* Home Win Button */}
            <Button
              variant="outline"
              disabled={isEnded || !match.homeMarket}
              onClick={() => handleBetClick(match.homeMarket, match.homeTeam)}
              className={`h-11 rounded-lg font-medium transition-all duration-200 ${
                winningOutcome === "home"
                  ? "bg-green-500/10 text-green-500 border-green-500/40 hover:bg-green-500/15"
                  : isEnded
                  ? "bg-muted/10 border-border/30 text-muted-foreground"
                  : "bg-background/20 hover:bg-primary/10 hover:text-primary hover:border-primary border-border/60"
              }`}
            >
              {getShortName(match.homeTeam)}
            </Button>

            {/* Draw Button */}
            <Button
              variant="outline"
              disabled={isEnded || !match.drawMarket}
              onClick={() => handleBetClick(match.drawMarket, "DRAW")}
              className={`h-11 rounded-lg font-medium transition-all duration-200 ${
                winningOutcome === "draw"
                  ? "bg-green-500/10 text-green-500 border-green-500/40 hover:bg-green-500/15"
                  : isEnded
                  ? "bg-muted/10 border-border/30 text-muted-foreground"
                  : "bg-background/20 hover:bg-primary/10 hover:text-primary hover:border-primary border-border/60"
              }`}
            >
              DRAW
            </Button>

            {/* Away Win Button */}
            <Button
              variant="outline"
              disabled={isEnded || !match.awayMarket}
              onClick={() => handleBetClick(match.awayMarket, match.awayTeam)}
              className={`h-11 rounded-lg font-medium transition-all duration-200 ${
                winningOutcome === "away"
                  ? "bg-green-500/10 text-green-500 border-green-500/40 hover:bg-green-500/15"
                  : isEnded
                  ? "bg-muted/10 border-border/30 text-muted-foreground"
                  : "bg-background/20 hover:bg-primary/10 hover:text-primary hover:border-primary border-border/60"
              }`}
            >
              {getShortName(match.awayTeam)}
            </Button>
          </div>

          {/* Footer Metadata */}
          <div className="flex justify-between items-center text-xs text-muted-foreground border-t border-border/20 pt-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-foreground/70">{formattedVolume}</span>
              <span>•</span>
              <span className="bg-primary/5 text-primary/80 px-2 py-0.5 rounded border border-primary/5 font-medium">
                {match.league}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-muted-foreground/60" />
                {format(new Date(match.matchDate), "MMM d, h:mm a")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedMarketId > 0 && (
        <BetModal
          isOpen={betModalOpen}
          onClose={() => {
            setBetModalOpen(false);
            setSelectedMarketId(0);
          }}
          marketId={selectedMarketId}
          question={selectedQuestion}
          isYes={true} // Betting ON the selected outcome is always YES on its binary market
          outcomeName={selectedOutcomeName}
        />
      )}
    </>
  );
}
