import { useEffect, useState } from "react";
import { useWeb3 } from "@/lib/web3";
import { Market, MarketCard } from "@/components/market-card";
import { Navbar } from "@/components/navbar";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// Oracle-verifiable prediction markets
// These can be settled using price feeds from Chainlink, Pyth, CoinGecko, or other data providers
const MOCK_MARKETS: Market[] = [
  // === PRICE TARGET MARKETS (Chainlink/Pyth Price Feeds) ===
  {
    id: 999,
    question: "Will Bitcoin (BTC) break $150,000 before Q2 2026?",
    totalYes: "45000",
    totalNo: "32000",
    endTime: Math.floor(new Date("2026-04-01").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "Chainlink BTC/USD",
    isOnChain: false
  },
  {
    id: 998,
    question: "Will Ethereum (ETH) reach $6,000 before June 2026?",
    totalYes: "28000",
    totalNo: "19000",
    endTime: Math.floor(new Date("2026-06-01").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "Chainlink ETH/USD",
    isOnChain: false
  },
  {
    id: 997,
    question: "Will Solana (SOL) hit $400 before September 2026?",
    totalYes: "12000",
    totalNo: "18000",
    endTime: Math.floor(new Date("2026-09-01").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "Pyth SOL/USD",
    isOnChain: false
  },
  {
    id: 996,
    question: "Will XRP break $5 in 2026?",
    totalYes: "8500",
    totalNo: "6200",
    endTime: Math.floor(new Date("2026-12-31").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "Chainlink XRP/USD",
    isOnChain: false
  },
  
  // === MARKET CAP MARKETS (CoinGecko/CoinMarketCap API) ===
  {
    id: 995,
    question: "Will Ethereum flippen Bitcoin by market cap in 2026?",
    totalYes: "5000",
    totalNo: "42000",
    endTime: Math.floor(new Date("2026-12-31").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "CoinGecko Market Cap",
    isOnChain: false
  },
  {
    id: 994,
    question: "Will a memecoin enter the top 5 by market cap?",
    totalYes: "15000",
    totalNo: "8000",
    endTime: Math.floor(new Date("2026-06-30").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "CoinMarketCap Rankings",
    isOnChain: false
  },
  
  // === DEFI TVL MARKETS (DefiLlama API) ===
  {
    id: 993,
    question: "Will Total DeFi TVL exceed $300 billion in 2026?",
    totalYes: "22000",
    totalNo: "11000",
    endTime: Math.floor(new Date("2026-12-31").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "DefiLlama TVL",
    isOnChain: false
  },
  {
    id: 992,
    question: "Will Aave TVL surpass $50 billion by Q3 2026?",
    totalYes: "9500",
    totalNo: "7200",
    endTime: Math.floor(new Date("2026-09-30").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "DefiLlama Protocol TVL",
    isOnChain: false
  },
  
  // === NETWORK METRICS (On-chain Data) ===
  {
    id: 991,
    question: "Will Ethereum daily active addresses exceed 2 million?",
    totalYes: "18000",
    totalNo: "14000",
    endTime: Math.floor(new Date("2026-06-30").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "Etherscan Analytics",
    isOnChain: false
  },
  {
    id: 990,
    question: "Will Bitcoin hashrate exceed 1000 EH/s?",
    totalYes: "11000",
    totalNo: "9000",
    endTime: Math.floor(new Date("2026-08-31").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "Blockchain.com Hashrate",
    isOnChain: false
  },
  
  // === STABLECOIN MARKETS ===
  {
    id: 989,
    question: "Will USDC market cap exceed $80 billion?",
    totalYes: "16000",
    totalNo: "8500",
    endTime: Math.floor(new Date("2026-06-30").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "CoinGecko Stablecoin Data",
    isOnChain: false
  },
  
  // === PROTOCOL EVENTS ===
  {
    id: 988,
    question: "Will ARC Mainnet launch before Q1 2026?",
    totalYes: "25000",
    totalNo: "5000",
    endTime: Math.floor(new Date("2026-03-31").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "Official Announcement",
    isOnChain: false
  },
  {
    id: 987,
    question: "Will Ethereum complete Verkle Trees upgrade in 2026?",
    totalYes: "19000",
    totalNo: "12000",
    endTime: Math.floor(new Date("2026-12-31").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "Ethereum.org Updates",
    isOnChain: false
  },
  
  // === EXCHANGE & TRADING VOLUME ===
  {
    id: 986,
    question: "Will daily CEX trading volume exceed $1 Trillion?",
    totalYes: "7500",
    totalNo: "12500",
    endTime: Math.floor(new Date("2026-06-30").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "CoinGecko Exchange Volume",
    isOnChain: false
  },
  {
    id: 985,
    question: "Will Uniswap monthly volume exceed $200 billion?",
    totalYes: "13000",
    totalNo: "9000",
    endTime: Math.floor(new Date("2026-06-30").getTime() / 1000),
    resolved: false,
    outcome: 0,
    oracle: "Dune Analytics",
    isOnChain: false
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
        const fetchedMarkets: Market[] = [];
        
        // Fetch up to 50 markets from the contract
        for (let i = 0; i < 50; i++) {
          try {
            const m = await contract.markets(i);
            
            fetchedMarkets.push({
              id: Number(m.id),
              question: m.question,
              totalYes: (Number(m.totalYesAmount) / 1000000).toString(),
              totalNo: (Number(m.totalNoAmount) / 1000000).toString(),
              endTime: Number(m.endTime),
              resolved: m.isResolved,
              outcome: Number(m.outcome),
              isOnChain: true
            });
          } catch (e) {
            // Stop if we hit an error (out of bounds)
            break;
          }
        }

        if (fetchedMarkets.length > 0) {
          // Show only on-chain markets when they exist
          setMarkets(fetchedMarkets);
        } else {
          // Show preview markets only when no on-chain markets exist
          setMarkets(MOCK_MARKETS);
        }
      } catch (error) {
        console.error("Failed to fetch markets", error);
        setMarkets(MOCK_MARKETS);
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
