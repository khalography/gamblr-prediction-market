import { useState, useMemo } from "react";
import { useWeb3 } from "@/lib/web3";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, CheckCircle, AlertCircle, Shield } from "lucide-react";
import { format } from "date-fns";

interface PreviewMarket {
  question: string;
  endDate: string;
  oracle: string;
}

const PREVIEW_MARKETS: PreviewMarket[] = [
  // EPL THIS WEEKEND (Nov 29-30, 2025)
  { question: "Will Manchester City beat Leeds United this weekend?", endDate: "2025-11-29", oracle: "Premier League Results" },
  { question: "Will Everton beat Newcastle United this weekend?", endDate: "2025-11-29", oracle: "Premier League Results" },
  { question: "Will Tottenham beat Fulham this weekend?", endDate: "2025-11-29", oracle: "Premier League Results" },
  { question: "Will Brentford beat Burnley this weekend?", endDate: "2025-11-29", oracle: "Premier League Results" },
  { question: "Will Manchester United beat Crystal Palace this weekend?", endDate: "2025-11-30", oracle: "Premier League Results" },
  { question: "Will Liverpool beat West Ham this weekend?", endDate: "2025-11-30", oracle: "Premier League Results" },
  { question: "Will Arsenal beat Chelsea in the London Derby?", endDate: "2025-11-30", oracle: "Premier League Results" },
  { question: "Will Chelsea beat Arsenal in the London Derby?", endDate: "2025-11-30", oracle: "Premier League Results" },
  { question: "Will Aston Villa beat Wolverhampton this weekend?", endDate: "2025-11-30", oracle: "Premier League Results" },
  { question: "Will Nottingham Forest beat Brighton this weekend?", endDate: "2025-11-30", oracle: "Premier League Results" },
  // POLITICS - GERMANY (Feb 2025)
  { question: "Will AfD become the largest party in German Bundestag?", endDate: "2025-02-23", oracle: "Bundeswahlleiter Results" },
  // POLITICS - CANADA (Oct 2025)
  { question: "Will the Conservative Party win Canada's Federal Election?", endDate: "2025-10-20", oracle: "Elections Canada Results" },
  // SUPER BOWL LX (Feb 2026)
  { question: "Will the Kansas City Chiefs win Super Bowl LX (2026)?", endDate: "2026-02-08", oracle: "NFL Official Results" },
  { question: "Will Patrick Mahomes win Super Bowl LX MVP?", endDate: "2026-02-08", oracle: "NFL Official Results" },
  // WINTER OLYMPICS 2026 (Feb 2026)
  { question: "Will USA top the medal count at 2026 Winter Olympics?", endDate: "2026-02-22", oracle: "Olympics Official Results" },
  { question: "Will Norway win the most gold medals at Milano Cortina 2026?", endDate: "2026-02-22", oracle: "Olympics Official Results" },
  // ARC NETWORK (Mar 2026)
  { question: "Will ARC Mainnet launch before Q1 2026?", endDate: "2026-03-31", oracle: "Official Announcement" },
  // CRYPTO (Apr 2026)
  { question: "Will Bitcoin (BTC) break $150,000 before Q2 2026?", endDate: "2026-04-01", oracle: "Chainlink BTC/USD" },
  // CRYPTO (Jun 2026)
  { question: "Will Ethereum (ETH) reach $6,000 before June 2026?", endDate: "2026-06-01", oracle: "Chainlink ETH/USD" },
  // NBA (Jun 2026)
  { question: "Will the Boston Celtics repeat as NBA Champions in 2026?", endDate: "2026-06-30", oracle: "NBA Official Results" },
  { question: "Will a memecoin enter the top 5 by market cap?", endDate: "2026-06-30", oracle: "CoinMarketCap Rankings" },
  // FIFA WORLD CUP 2026 (Jul 2026)
  { question: "Will USA advance past the Round of 16 in 2026 World Cup?", endDate: "2026-07-07", oracle: "FIFA Official Results" },
  { question: "Will Brazil reach the 2026 World Cup Semi-Finals?", endDate: "2026-07-15", oracle: "FIFA Official Results" },
  { question: "Will Argentina win the 2026 FIFA World Cup?", endDate: "2026-07-19", oracle: "FIFA Official Results" },
  { question: "Will France reach the 2026 World Cup Final?", endDate: "2026-07-19", oracle: "FIFA Official Results" },
  { question: "Will England win the 2026 FIFA World Cup?", endDate: "2026-07-19", oracle: "FIFA Official Results" },
  // CRYPTO (Aug-Sep 2026)
  { question: "Will Bitcoin hashrate exceed 1000 EH/s?", endDate: "2026-08-31", oracle: "Blockchain.com Hashrate" },
  { question: "Will Solana (SOL) hit $400 before September 2026?", endDate: "2026-09-01", oracle: "Pyth SOL/USD" },
  // NBA (Oct 2026)
  { question: "Will LeBron James still be active in the NBA in 2026?", endDate: "2026-10-01", oracle: "NBA Official Roster" },
  // POLITICS - BRAZIL (Oct 2026)
  { question: "Will a far-right candidate reach Brazil's 2026 Presidential runoff?", endDate: "2026-10-04", oracle: "TSE Brazil Official Results" },
  { question: "Will Lula win re-election in Brazil's 2026 Presidential Election?", endDate: "2026-10-25", oracle: "TSE Brazil Official Results" },
  // POLITICS - US MIDTERMS (Nov 2026)
  { question: "Will Democrats win the House majority in 2026 US Midterms?", endDate: "2026-11-03", oracle: "AP Election Results" },
  { question: "Will Democrats win the Senate majority in 2026 US Midterms?", endDate: "2026-11-03", oracle: "AP Election Results" },
  { question: "Will voter turnout exceed 50% in 2026 US Midterms?", endDate: "2026-11-03", oracle: "US Election Project" },
  // CRYPTO & DEFI (Dec 2026)
  { question: "Will XRP break $5 in 2026?", endDate: "2026-12-31", oracle: "Chainlink XRP/USD" },
  { question: "Will Ethereum flippen Bitcoin by market cap in 2026?", endDate: "2026-12-31", oracle: "CoinGecko Market Cap" },
  { question: "Will Total DeFi TVL exceed $300 billion in 2026?", endDate: "2026-12-31", oracle: "DefiLlama TVL" },
  { question: "Will Ethereum complete Verkle Trees upgrade in 2026?", endDate: "2026-12-31", oracle: "Ethereum.org Updates" },
];

export default function Admin() {
  const { contract, account } = useWeb3();
  const isConnected = !!account;
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [createdMarkets, setCreatedMarkets] = useState<Set<number>>(new Set());
  const [customQuestion, setCustomQuestion] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const createMarket = async (question: string, endDateStr: string, index?: number) => {
    if (!contract) {
      toast({ title: "Error", description: "Please connect your wallet first", variant: "destructive" });
      return;
    }

    const loadingKey = index !== undefined ? `market-${index}` : "custom";
    setLoading(loadingKey);

    try {
      const endDate = new Date(endDateStr);
      const now = new Date();
      const durationSeconds = Math.floor((endDate.getTime() - now.getTime()) / 1000);

      if (durationSeconds <= 0) {
        throw new Error("End date must be in the future");
      }

      const tx = await contract.createMarket(question, durationSeconds);
      toast({ title: "Transaction Sent", description: "Waiting for confirmation..." });
      
      await tx.wait();
      
      toast({ 
        title: "Market Created!", 
        description: `"${question.slice(0, 50)}..." is now live on-chain` 
      });

      if (index !== undefined) {
        setCreatedMarkets(prev => new Set(Array.from(prev).concat([index])));
      } else {
        setCustomQuestion("");
        setCustomEndDate("");
      }
    } catch (error: any) {
      console.error("Create market error:", error);
      let message = "Failed to create market";
      
      if (error.message?.includes("OwnableUnauthorizedAccount")) {
        message = "Only the contract owner can create markets. Please connect with the owner wallet.";
      } else if (error.message?.includes("user rejected")) {
        message = "Transaction was rejected";
      } else if (error.reason) {
        message = error.reason;
      }
      
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const createAllMarkets = async () => {
    for (let i = 0; i < PREVIEW_MARKETS.length; i++) {
      if (!createdMarkets.has(i)) {
        await createMarket(PREVIEW_MARKETS[i].question, PREVIEW_MARKETS[i].endDate, i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-lg mx-auto">
            <CardHeader className="text-center">
              <Shield className="w-16 h-16 mx-auto text-primary mb-4" />
              <CardTitle>Admin Access Required</CardTitle>
              <CardDescription>
                Please connect your owner wallet to create markets on the Gamblr contract.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold font-display text-primary">Admin Panel</h1>
            <p className="text-muted-foreground mt-2">
              Create prediction markets on the Gamblr smart contract
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Connected: {account?.slice(0, 6)}...{account?.slice(-4)}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create Custom Market
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="question">Market Question</Label>
                <Input
                  id="question"
                  placeholder="Will Bitcoin reach $100,000 by end of 2025?"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  data-testid="input-custom-question"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd")}
                  data-testid="input-custom-end-date"
                />
              </div>
              <Button
                onClick={() => createMarket(customQuestion, customEndDate)}
                disabled={!customQuestion || !customEndDate || loading === "custom"}
                className="w-full"
                data-testid="button-create-custom-market"
              >
                {loading === "custom" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Market
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Preview Markets</CardTitle>
                <CardDescription>
                  Deploy these pre-configured markets to the contract
                </CardDescription>
              </div>
              <Button
                onClick={createAllMarkets}
                disabled={loading !== null || createdMarkets.size === PREVIEW_MARKETS.length}
                variant="outline"
                data-testid="button-create-all-markets"
              >
                {loading !== null ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>Create All ({PREVIEW_MARKETS.length - createdMarkets.size} remaining)</>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {PREVIEW_MARKETS.map((market, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      createdMarkets.has(index)
                        ? "bg-primary/5 border-primary/30"
                        : "bg-card/50"
                    }`}
                    data-testid={`preview-market-${index}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium">{market.question}</p>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Ends: {format(new Date(market.endDate), "MMM d, yyyy")}</span>
                          <span>Oracle: {market.oracle}</span>
                        </div>
                      </div>
                      {createdMarkets.has(index) ? (
                        <div className="flex items-center gap-2 text-primary">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-sm font-medium">Created</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => createMarket(market.question, market.endDate, index)}
                          disabled={loading !== null}
                          data-testid={`button-create-market-${index}`}
                        >
                          {loading === `market-${index}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Create"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Important Notes</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Only the contract owner can create markets</li>
                    <li>Each market creation requires a transaction on Arc testnet</li>
                    <li>Make sure you have enough testnet ETH for gas fees</li>
                    <li>Markets cannot be deleted once created</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
