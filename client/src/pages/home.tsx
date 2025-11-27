import { useEffect, useState } from "react";
import { useWeb3 } from "@/lib/web3";
import { Market, MarketCard } from "@/components/market-card";
import { Navbar } from "@/components/navbar";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mock data for initial display or fallback
const MOCK_MARKETS: Market[] = [
  {
    id: 999,
    question: "Will Bitcoin (BTC) break $100,000 before 2026?",
    totalYes: "15000",
    totalNo: "12000",
    endTime: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
    resolved: false,
    outcome: 0
  },
  {
    id: 998,
    question: "Will Ethereum (ETH) flippen Bitcoin by market cap in 2025?",
    totalYes: "5000",
    totalNo: "25000",
    endTime: Math.floor(Date.now() / 1000) + 86400 * 60,
    resolved: false,
    outcome: 0
  },
  {
    id: 997,
    question: "Will ARC Mainnet launch before Q2 2025?",
    totalYes: "8000",
    totalNo: "2000",
    endTime: Math.floor(Date.now() / 1000) + 86400 * 14,
    resolved: false,
    outcome: 0
  }
];

export default function Home() {
  const { contract, provider } = useWeb3();
  const [markets, setMarkets] = useState<Market[]>(MOCK_MARKETS);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchMarkets = async () => {
      if (!contract) return;
      
      setIsLoading(true);
      try {
        // Try to fetch first 5 markets
        const fetchedMarkets: Market[] = [];
        
        // We don't have a getMarketCount, so we'll try fetching ID 0, 1, 2... until fail
        // Or just fetch a fixed number for this demo since we can't read array length easily from public array getter in standard ethers without a wrapper
        // Actually, public array getter throws if out of bounds usually.
        
        for (let i = 0; i < 5; i++) {
          try {
            const m = await contract.markets(i);
            // m is a struct-like array/object
            // Struct: id, question, totalYesAmount, totalNoAmount, outcome, isResolved, endTime
            
            fetchedMarkets.push({
              id: Number(m.id),
              question: m.question,
              totalYes: (Number(m.totalYesAmount) / 1000000).toString(), // 6 decimals
              totalNo: (Number(m.totalNoAmount) / 1000000).toString(),
              endTime: Number(m.endTime),
              resolved: m.isResolved,
              outcome: Number(m.outcome)
            });
          } catch (e) {
            // Stop if we hit an error (likely out of bounds)
            break;
          }
        }

        if (fetchedMarkets.length > 0) {
          setMarkets([...fetchedMarkets, ...MOCK_MARKETS]); // Show both for demo purposes
        }
      } catch (error) {
        console.error("Failed to fetch markets", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarkets();
  }, [contract]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Navbar />
      
      <header className="relative overflow-hidden border-b border-primary/10 py-20 sm:py-32 bg-secondary/20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/30 opacity-30 blur-[100px]"></div>
        
        <div className="container relative z-10 text-center px-4">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Welcome to Gamblr!
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            The home of predictions on Arc Testnet. Bet on future outcomes with USDC.
          </p>
          
          <Button 
            variant="outline" 
            className="gap-2 border-primary/20 hover:bg-primary/10 hover:text-primary"
            onClick={() => window.open("https://faucet.circle.com/", "_blank")}
          >
            Get Testnet USDC <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="container px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-2 h-8 rounded-full bg-primary inline-block"></span>
            Active Markets
          </h2>
          {isLoading && <Loader2 className="animate-spin text-primary" />}
        </div>

        {markets.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl">
            <AlertCircle className="mx-auto h-10 w-10 mb-4 opacity-50" />
            <p>No active markets found. Connect wallet to sync.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
