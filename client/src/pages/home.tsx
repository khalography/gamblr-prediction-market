import { useEffect, useState } from "react";
import { useWeb3 } from "@/lib/web3";
import { Market, MarketCard } from "@/components/market-card";
import { SportsCard, SportsMatch } from "@/components/sports-card";
import { Navbar } from "@/components/navbar";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ethers } from "ethers";
import { GAMBLR_ABI, GAMBLR_ADDRESS, ARC_TESTNET_RPC } from "@/lib/gamblr-abi";
import bannerImage from "@assets/yupp-generated-image-925890_1764331757996.jpg";
import { RequestMarketModal } from "@/components/request-market-modal";


export default function Home() {
  const [sportsMatches, setSportsMatches] = useState<SportsMatch[]>([]);
  const [standaloneMarkets, setStandaloneMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  useEffect(() => {
    const fetchMarkets = async () => {
      setIsLoading(true);
      try {
        const readProvider = new ethers.JsonRpcProvider(ARC_TESTNET_RPC);
        const readContract = new ethers.Contract(GAMBLR_ADDRESS, GAMBLR_ABI, readProvider);
        
        // 1. Fetch linked markets from API
        let linkedData: any[] = [];
        try {
          const linkedRes = await fetch("/api/markets/linked");
          if (linkedRes.ok) {
            linkedData = await linkedRes.json();
          }
        } catch (err) {
          console.error("Failed to fetch linked markets:", err);
        }

        // 2. Find the latest market ID by binary search (avoids concurrent RPC spam)
        let low = 0;
        let high = 2000;
        let latestId = 0;
        
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          try {
            const m = await readContract.markets(mid);
            if (m && m.question && m.question !== "") {
              latestId = mid;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          } catch {
            high = mid - 1;
          }
        }

        // 3. Fetch the last 50 on-chain markets in batches to avoid rate limits
        const fetchedMarkets: Market[] = [];
        const fetchedIds = new Set<number>();
        const startId = Math.max(0, latestId - 49);
        const fetchIdsList = Array.from({ length: latestId - startId + 1 }, (_, i) => latestId - i);

        const batchSize = 10;
        for (let i = 0; i < fetchIdsList.length; i += batchSize) {
          const batch = fetchIdsList.slice(i, i + batchSize);
          const marketResults = await Promise.allSettled(
            batch.map(id => readContract.markets(id))
          );

          for (let j = 0; j < batch.length; j++) {
            const res = marketResults[j];
            const mId = batch[j];
            if (res.status === "fulfilled") {
              const m = res.value;
              if (m && m.question && m.question !== "") {
                fetchedMarkets.push({
                  id: Number(m.id || mId),
                  question: m.question,
                  totalYes: (Number(m.totalYesAmount) / 1000000).toString(),
                  totalNo: (Number(m.totalNoAmount) / 1000000).toString(),
                  endTime: Number(m.endTime),
                  resolved: m.isResolved,
                  outcome: Number(m.outcome),
                  isOnChain: true
                });
                fetchedIds.add(mId);
              }
            }
          }
        }

        // 4. Ensure any linked markets outside the last 50 are also fetched in parallel
        const extraIds = linkedData
          .map((link: any) => link.marketEvent.marketId)
          .filter((mId: number) => !fetchedIds.has(mId));

        if (extraIds.length > 0) {
          const extraResults = await Promise.allSettled(
            extraIds.map(id => readContract.markets(id))
          );
          
          for (let i = 0; i < extraIds.length; i++) {
            const res = extraResults[i];
            const mId = extraIds[i];
            if (res.status === "fulfilled") {
              const m = res.value;
              if (m && m.question && m.question !== "") {
                fetchedMarkets.push({
                  id: Number(m.id || mId),
                  question: m.question,
                  totalYes: (Number(m.totalYesAmount) / 1000000).toString(),
                  totalNo: (Number(m.totalNoAmount) / 1000000).toString(),
                  endTime: Number(m.endTime),
                  resolved: m.isResolved,
                  outcome: Number(m.outcome),
                  isOnChain: true
                });
                fetchedIds.add(mId);
              }
            }
          }
        }

        if (fetchedMarkets.length > 0) {
          const marketMap = new Map<number, Market>();
          
          // Remove duplicates by question (keep first occurrence)
          const seen = new Set<string>();
          const uniqueMarkets = fetchedMarkets.filter(market => {
            const key = market.question.toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          uniqueMarkets.forEach(m => marketMap.set(m.id, m));

          // Group sports matches by sportsEvent.id
          const sportsMatchesMap = new Map<string, SportsMatch>();
          const sportsMarketIds = new Set<number>();

          linkedData.forEach((link: any) => {
            const sportsEvent = link.sportsEvent;
            const marketEvent = link.marketEvent;
            const onChainMarket = marketMap.get(marketEvent.marketId);

            if (!onChainMarket) return; // Skip if market is not found

            sportsMarketIds.add(marketEvent.marketId);

            let match = sportsMatchesMap.get(sportsEvent.id);
            if (!match) {
              match = {
                id: sportsEvent.id,
                homeTeam: sportsEvent.homeTeam,
                awayTeam: sportsEvent.awayTeam,
                league: sportsEvent.league,
                matchDate: sportsEvent.matchDate,
                status: sportsEvent.status,
                homeScore: sportsEvent.homeScore,
                awayScore: sportsEvent.awayScore,
                homeMarket: null,
                drawMarket: null,
                awayMarket: null,
              };
              sportsMatchesMap.set(sportsEvent.id, match);
            }

            if (marketEvent.betType === "home_win" || (marketEvent.betType === "team_win" && marketEvent.targetTeam === sportsEvent.homeTeam)) {
              match.homeMarket = onChainMarket;
            } else if (marketEvent.betType === "draw") {
              match.drawMarket = onChainMarket;
            } else if (marketEvent.betType === "away_win" || (marketEvent.betType === "team_win" && marketEvent.targetTeam === sportsEvent.awayTeam)) {
              match.awayMarket = onChainMarket;
            }
          });

          const groupedMatches = Array.from(sportsMatchesMap.values());
          const standalone = uniqueMarkets.filter(m => !sportsMarketIds.has(m.id));

          // Sort matches: Earlier match dates first
          groupedMatches.sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

          // Sort standalone markets
          const nowSec = Date.now() / 1000;
          standalone.sort((a, b) => {
            const aEnded = a.endTime < nowSec;
            const bEnded = b.endTime < nowSec;
            if (aEnded && !bEnded) return 1;
            if (!aEnded && bEnded) return -1;
            return a.endTime - b.endTime;
          });

          setSportsMatches(groupedMatches);
          setStandaloneMarkets(standalone);
        } else {
          setSportsMatches([]);
          setStandaloneMarkets([]);
        }
      } catch (error) {
        console.error("Failed to fetch markets:", error);
        setSportsMatches([]);
        setStandaloneMarkets([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarkets();
  }, []);

  const now = Math.floor(Date.now() / 1000);

  // Grouped active vs ended
  const activeSportsMatches = sportsMatches.filter(
    (m) => m.status !== "FT" && new Date(m.matchDate).getTime() > Date.now()
  );
  const endedSportsMatches = sportsMatches.filter(
    (m) => m.status === "FT" || new Date(m.matchDate).getTime() <= Date.now()
  );

  const activeStandalone = standaloneMarkets.filter(
    (m) => !m.resolved && m.endTime > now
  );
  const endedStandalone = standaloneMarkets.filter(
    (m) => m.resolved || m.endTime <= now
  );

  const hasActivePredictions = activeSportsMatches.length > 0 || activeStandalone.length > 0;
  const hasEndedPredictions = endedSportsMatches.length > 0 || endedStandalone.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Navbar />
      
      <header 
        className="relative overflow-hidden border-b border-primary/10 py-20 sm:py-32"
        style={{
          backgroundImage: `url(${bannerImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        
        <div className="container relative z-10 text-center px-4">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-6 bg-gradient-to-b from-white to-white bg-clip-text text-transparent drop-shadow-lg">
            Welcome to Gamblr!
          </h1>
          <p className="text-xl font-bold text-white max-w-2xl mx-auto mb-8 drop-shadow-lg">
            The home of predictions on Arc Testnet. Bet on future outcomes with USDC.
          </p>
          
          <div className="flex justify-center gap-4 flex-wrap">
            <Button 
              variant="outline" 
              className="gap-2 border-primary/20 hover:bg-primary/10 hover:text-primary bg-white/5 backdrop-blur-sm"
              onClick={() => window.open("https://faucet.circle.com/", "_blank")}
            >
              Get Testnet USDC <ExternalLink className="h-4 w-4" />
            </Button>

            <Button
              className="gap-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-6"
              onClick={() => setRequestModalOpen(true)}
            >
              Request a Market
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-12 space-y-16">
        {/* Active Markets Section */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span className="w-2 h-8 rounded-full bg-primary inline-block"></span>
              Active Markets
            </h2>
            {isLoading && <Loader2 className="animate-spin text-primary" />}
          </div>

          {isLoading ? (
            <div className="text-center py-20 text-foreground border border-dashed rounded-xl">
              <Loader2 className="mx-auto h-10 w-10 mb-4 animate-spin text-primary" />
              <p>Please wait while we load available markets.</p>
            </div>
          ) : !hasActivePredictions ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl bg-muted/10">
              <AlertCircle className="mx-auto h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm font-medium">No active markets available at the moment.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {/* Sports Section */}
              {activeSportsMatches.length > 0 && (
                <div className="space-y-5">
                  <h3 className="text-base font-bold text-muted-foreground tracking-wide uppercase">
                    World Cup Matches (1X2)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeSportsMatches.map((match) => (
                      <SportsCard key={match.id} match={match} />
                    ))}
                  </div>
                </div>
              )}

              {/* General Markets Section */}
              {activeStandalone.length > 0 && (
                <div className="space-y-5">
                  <h3 className="text-base font-bold text-muted-foreground tracking-wide uppercase">
                    General Prediction Markets
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeStandalone.map((market) => (
                      <MarketCard key={market.id} market={market} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Ended Markets Section */}
        {!isLoading && hasEndedPredictions && (
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-muted-foreground">
                <span className="w-2 h-8 rounded-full bg-slate-600 inline-block"></span>
                Ended Markets
              </h2>
            </div>

            <div className="space-y-10 opacity-70">
              {endedSportsMatches.length > 0 && (
                <div className="space-y-5">
                  <h3 className="text-base font-bold text-muted-foreground tracking-wide uppercase">
                    World Cup Matches Results
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {endedSportsMatches.map((match) => (
                      <SportsCard key={match.id} match={match} />
                    ))}
                  </div>
                </div>
              )}

              {endedStandalone.length > 0 && (
                <div className="space-y-5">
                  <h3 className="text-base font-bold text-muted-foreground tracking-wide uppercase">
                    General Markets Results
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {endedStandalone.map((market) => (
                      <MarketCard key={market.id} market={market} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <RequestMarketModal 
        isOpen={requestModalOpen} 
        onClose={() => setRequestModalOpen(false)} 
      />
    </div>
  );
}
