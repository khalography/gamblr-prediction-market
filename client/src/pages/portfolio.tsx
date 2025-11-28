import { useEffect, useState } from "react";
import { useWeb3 } from "@/lib/web3";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
  History,
  Trophy,
  Loader2
} from "lucide-react";
import { ethers } from "ethers";
import { GAMBLR_ABI, GAMBLR_ADDRESS, ARC_TESTNET_RPC } from "@/lib/gamblr-abi";
import { format } from "date-fns";

interface Transaction {
  type: "deposit" | "withdraw" | "bet" | "claim";
  amount: string;
  fee?: string;
  timestamp: number;
  txHash: string;
  details?: string;
}

interface BetPosition {
  marketId: number;
  question: string;
  isYes: boolean;
  amount: string;
  outcome: number; // 0 = pending, 1 = yes won, 2 = no won, 3 = void
  claimed: boolean;
  endTime: number;
}

export default function Portfolio() {
  const { account, internalBalance, contract } = useWeb3();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [positions, setPositions] = useState<BetPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalBet: 0,
    totalWon: 0,
    totalLost: 0,
    activeBets: 0
  });

  useEffect(() => {
    const fetchUserActivity = async () => {
      if (!account) return;
      
      setIsLoading(true);
      try {
        const provider = new ethers.JsonRpcProvider(ARC_TESTNET_RPC);
        const readContract = new ethers.Contract(GAMBLR_ADDRESS, GAMBLR_ABI, provider);
        
        // Get current block and calculate range (RPC limits to 10,000 blocks)
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 9000); // Stay under 10k limit
        
        // Get all events for this user within the allowed range
        const depositFilter = readContract.filters.Deposit(account);
        const withdrawFilter = readContract.filters.Withdraw(account);
        const betFilter = readContract.filters.BetPlaced(null, account);
        const claimFilter = readContract.filters.WinningsClaimed(null, account);
        
        const [depositEvents, withdrawEvents, betEvents, claimEvents] = await Promise.all([
          readContract.queryFilter(depositFilter, fromBlock, currentBlock),
          readContract.queryFilter(withdrawFilter, fromBlock, currentBlock),
          readContract.queryFilter(betFilter, fromBlock, currentBlock),
          readContract.queryFilter(claimFilter, fromBlock, currentBlock)
        ]);

        const allTransactions: Transaction[] = [];
        let totalDeposited = 0;
        let totalWithdrawn = 0;
        let totalBet = 0;
        let totalWon = 0;

        // Process deposits
        for (const event of depositEvents) {
          const args = (event as any).args;
          const amount = Number(args.amount) / 1000000;
          const fee = Number(args.fee) / 1000000;
          totalDeposited += amount;
          
          const block = await event.getBlock();
          allTransactions.push({
            type: "deposit",
            amount: amount.toFixed(2),
            fee: fee.toFixed(2),
            timestamp: block?.timestamp || 0,
            txHash: event.transactionHash
          });
        }

        // Process withdrawals
        for (const event of withdrawEvents) {
          const args = (event as any).args;
          const amount = Number(args.amount) / 1000000;
          const fee = Number(args.fee) / 1000000;
          totalWithdrawn += amount;
          
          const block = await event.getBlock();
          allTransactions.push({
            type: "withdraw",
            amount: amount.toFixed(2),
            fee: fee.toFixed(2),
            timestamp: block?.timestamp || 0,
            txHash: event.transactionHash
          });
        }

        // First, cache all market data we need
        const marketCache = new Map<number, { question: string; outcome: number; endTime: number }>();
        
        // Process bets and build positions
        const positionsMap = new Map<string, BetPosition>();
        
        for (const event of betEvents) {
          const args = (event as any).args;
          const marketId = Number(args.marketId);
          const amount = Number(args.amount) / 1000000;
          const fee = Number(args.fee) / 1000000;
          const isYes = args.isYes;
          totalBet += amount + fee; // Include fee in total bet
          
          // Fetch market data if not cached
          if (!marketCache.has(marketId)) {
            try {
              const market = await readContract.markets(marketId);
              marketCache.set(marketId, {
                question: market.question || `Market #${marketId}`,
                outcome: Number(market.outcome),
                endTime: Number(market.endTime)
              });
            } catch (e) {
              marketCache.set(marketId, {
                question: `Market #${marketId}`,
                outcome: 0,
                endTime: 0
              });
            }
          }
          
          const marketData = marketCache.get(marketId)!;
          const block = await event.getBlock();
          
          allTransactions.push({
            type: "bet",
            amount: amount.toFixed(2),
            fee: fee.toFixed(2),
            timestamp: block?.timestamp || 0,
            txHash: event.transactionHash,
            details: `${isYes ? "YES" : "NO"} - ${marketData.question.slice(0, 40)}...`
          });

          // Build position
          const key = `${marketId}-${isYes}`;
          const existing = positionsMap.get(key);
          
          if (existing) {
            existing.amount = (parseFloat(existing.amount) + amount).toFixed(2);
          } else {
            positionsMap.set(key, {
              marketId,
              question: marketData.question,
              isYes,
              amount: amount.toFixed(2),
              outcome: marketData.outcome,
              claimed: false,
              endTime: marketData.endTime
            });
          }
        }

        // Process claims
        for (const event of claimEvents) {
          const args = (event as any).args;
          const marketId = Number(args.marketId);
          const amount = Number(args.amount) / 1000000;
          totalWon += amount;
          
          // Get market question from cache or fetch it
          let marketQuestion = `Market #${marketId}`;
          if (marketCache.has(marketId)) {
            marketQuestion = marketCache.get(marketId)!.question;
          } else {
            try {
              const market = await readContract.markets(marketId);
              marketQuestion = market.question || `Market #${marketId}`;
            } catch (e) {}
          }
          
          const block = await event.getBlock();
          allTransactions.push({
            type: "claim",
            amount: amount.toFixed(2),
            timestamp: block?.timestamp || 0,
            txHash: event.transactionHash,
            details: `Won: ${marketQuestion.slice(0, 40)}...`
          });

          // Mark position as claimed
          Array.from(positionsMap.entries()).forEach(([key, pos]) => {
            if (pos.marketId === marketId) {
              pos.claimed = true;
            }
          });
        }

        // Sort transactions by timestamp (newest first)
        allTransactions.sort((a, b) => b.timestamp - a.timestamp);

        // Calculate losses from resolved positions
        let totalLost = 0;
        const now = Date.now() / 1000;
        let activeBets = 0;
        const positionsArray = Array.from(positionsMap.values());
        
        for (const pos of positionsArray) {
          if (pos.outcome === 0 && pos.endTime > now) {
            activeBets++;
          } else if (pos.outcome !== 0 && pos.outcome !== 3) {
            const won = (pos.isYes && pos.outcome === 1) || (!pos.isYes && pos.outcome === 2);
            if (!won) {
              totalLost += parseFloat(pos.amount);
            }
          }
        }

        setTransactions(allTransactions);
        setPositions(positionsArray);
        setStats({
          totalDeposited,
          totalWithdrawn,
          totalBet,
          totalWon,
          totalLost,
          activeBets
        });

      } catch (error) {
        console.error("Failed to fetch user activity:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserActivity();
  }, [account]);

  if (!account) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-16">
          <Card className="max-w-lg mx-auto text-center">
            <CardHeader>
              <Wallet className="w-16 h-16 mx-auto text-primary mb-4" />
              <CardTitle>Connect Your Wallet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Connect wallet to experience prediction on Arc Testnet
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold font-display text-primary">Portfolio</h1>
            <p className="text-muted-foreground mt-1">Track your betting activity and performance</p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Wallet className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Balance</p>
                        <p className="text-2xl font-bold font-mono">${Number(internalBalance).toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-500/10">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Won</p>
                        <p className="text-2xl font-bold font-mono text-green-500">${stats.totalWon.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-red-500/10">
                        <TrendingDown className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Lost</p>
                        <p className="text-2xl font-bold font-mono text-red-500">${stats.totalLost.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-yellow-500/10">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Bets</p>
                        <p className="text-2xl font-bold font-mono">{stats.activeBets}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Activity Summary */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Deposited</p>
                  <p className="text-xl font-mono font-semibold">${stats.totalDeposited.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Withdrawn</p>
                  <p className="text-xl font-mono font-semibold">${stats.totalWithdrawn.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Bet</p>
                  <p className="text-xl font-mono font-semibold">${stats.totalBet.toFixed(2)}</p>
                </div>
              </div>

              <Tabs defaultValue="positions" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="positions" data-testid="tab-positions">Betting Positions</TabsTrigger>
                  <TabsTrigger value="history" data-testid="tab-history">Transaction History</TabsTrigger>
                </TabsList>

                <TabsContent value="positions" className="mt-6">
                  {positions.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center text-muted-foreground">
                        <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>No betting positions yet</p>
                        <p className="text-sm">Place your first bet to see it here</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {positions.map((pos, i) => {
                        const now = Date.now() / 1000;
                        const isActive = pos.outcome === 0 && pos.endTime > now;
                        const isWon = (pos.isYes && pos.outcome === 1) || (!pos.isYes && pos.outcome === 2);
                        const isLost = pos.outcome !== 0 && pos.outcome !== 3 && !isWon;
                        const isVoid = pos.outcome === 3;
                        
                        return (
                          <Card key={i} className={`${isWon ? 'border-green-500/30' : isLost ? 'border-red-500/30' : ''}`} data-testid={`position-${i}`}>
                            <CardContent className="py-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <p className="font-medium">{pos.question}</p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant={pos.isYes ? "default" : "destructive"}>
                                      {pos.isYes ? "YES" : "NO"}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                      ${pos.amount} USDC
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {isActive && (
                                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                                      Active
                                    </Badge>
                                  )}
                                  {isWon && (
                                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                                      {pos.claimed ? "Won (Claimed)" : "Won"}
                                    </Badge>
                                  )}
                                  {isLost && (
                                    <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
                                      Lost
                                    </Badge>
                                  )}
                                  {isVoid && (
                                    <Badge variant="outline">Void</Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                  {transactions.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center text-muted-foreground">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>No transactions yet</p>
                        <p className="text-sm">Your deposit, withdrawal, and betting activity will appear here</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((tx, i) => (
                        <Card key={i} data-testid={`transaction-${i}`}>
                          <CardContent className="py-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${
                                  tx.type === 'deposit' ? 'bg-green-500/10' :
                                  tx.type === 'withdraw' ? 'bg-red-500/10' :
                                  tx.type === 'claim' ? 'bg-primary/10' :
                                  'bg-yellow-500/10'
                                }`}>
                                  {tx.type === 'deposit' && <ArrowDownRight className="w-4 h-4 text-green-500" />}
                                  {tx.type === 'withdraw' && <ArrowUpRight className="w-4 h-4 text-red-500" />}
                                  {tx.type === 'claim' && <Trophy className="w-4 h-4 text-primary" />}
                                  {tx.type === 'bet' && <TrendingUp className="w-4 h-4 text-yellow-500" />}
                                </div>
                                <div>
                                  <p className="font-medium capitalize">{tx.type}</p>
                                  {tx.details && <p className="text-xs text-muted-foreground">{tx.details}</p>}
                                  {tx.timestamp > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(tx.timestamp * 1000), "MMM d, yyyy 'at' h:mm a")}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`font-mono font-semibold ${
                                  tx.type === 'deposit' || tx.type === 'claim' ? 'text-green-500' : 
                                  tx.type === 'withdraw' ? 'text-red-500' : ''
                                }`}>
                                  {tx.type === 'deposit' || tx.type === 'claim' ? '+' : '-'}${tx.amount}
                                </p>
                                {tx.fee && parseFloat(tx.fee) > 0 && (
                                  <p className="text-xs text-muted-foreground">Fee: ${tx.fee}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
