import { useEffect, useState, useMemo } from "react";
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
  Loader2,
  BarChart3,
  Target,
  Percent,
  Calendar
} from "lucide-react";
import { ethers } from "ethers";
import { GAMBLR_ABI, GAMBLR_ADDRESS, ARC_TESTNET_RPC } from "@/lib/gamblr-abi";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

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
  outcome: number;
  claimed: boolean;
  endTime: number;
}

interface DailyData {
  date: string;
  bets: number;
  volume: number;
  profit: number;
  cumulative: number;
}

export default function Portfolio() {
  const { account, internalBalance, getContract } = useWeb3();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [positions, setPositions] = useState<BetPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalBet: 0,
    totalWon: 0,
    totalLost: 0,
    activeBets: 0,
    winCount: 0,
    lossCount: 0,
    pendingCount: 0
  });

  const analytics = useMemo(() => {
    const winRate = stats.winCount + stats.lossCount > 0 
      ? ((stats.winCount / (stats.winCount + stats.lossCount)) * 100).toFixed(1)
      : "0.0";
    
    const netProfit = stats.totalWon - stats.totalLost;
    const roi = stats.totalBet > 0 
      ? ((netProfit / stats.totalBet) * 100).toFixed(1)
      : "0.0";
    
    const avgBetSize = stats.winCount + stats.lossCount + stats.pendingCount > 0
      ? (stats.totalBet / (stats.winCount + stats.lossCount + stats.pendingCount)).toFixed(2)
      : "0.00";

    return { winRate, netProfit, roi, avgBetSize };
  }, [stats]);

  const chartData = useMemo(() => {
    if (transactions.length === 0) return { daily: [], pieData: [] };

    const dailyMap = new Map<string, DailyData>();
    let cumulative = 0;

    const sortedTx = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

    for (const tx of sortedTx) {
      if (tx.timestamp === 0) continue;
      
      const date = format(new Date(tx.timestamp * 1000), "MMM d");
      const existing = dailyMap.get(date) || { date, bets: 0, volume: 0, profit: 0, cumulative: 0 };
      
      if (tx.type === "bet") {
        existing.bets += 1;
        existing.volume += parseFloat(tx.amount);
        cumulative -= parseFloat(tx.amount);
      } else if (tx.type === "claim") {
        existing.profit += parseFloat(tx.amount);
        cumulative += parseFloat(tx.amount);
      }
      
      existing.cumulative = cumulative;
      dailyMap.set(date, existing);
    }

    const daily = Array.from(dailyMap.values());

    const pieData = [
      { name: "Wins", value: stats.winCount, color: "#22c55e" },
      { name: "Losses", value: stats.lossCount, color: "#ef4444" },
      { name: "Pending", value: stats.pendingCount, color: "#eab308" }
    ].filter(d => d.value > 0);

    return { daily, pieData };
  }, [transactions, stats]);

  useEffect(() => {
    const fetchUserActivity = async () => {
      if (!account) return;
      
      setIsLoading(true);
      try {
        const provider = new ethers.JsonRpcProvider(ARC_TESTNET_RPC);
        const readContract = new ethers.Contract(GAMBLR_ADDRESS, GAMBLR_ABI, provider);
        
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 9000);
        
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

        const marketCache = new Map<number, { question: string; outcome: number; endTime: number }>();
        const positionsMap = new Map<string, BetPosition>();
        
        for (const event of betEvents) {
          const args = (event as any).args;
          const marketId = Number(args.marketId);
          const amount = Number(args.amount) / 1000000;
          const fee = Number(args.fee) / 1000000;
          const isYes = args.isYes;
          totalBet += amount + fee;
          
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

        for (const event of claimEvents) {
          const args = (event as any).args;
          const marketId = Number(args.marketId);
          const amount = Number(args.amount) / 1000000;
          totalWon += amount;
          
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

          Array.from(positionsMap.entries()).forEach(([key, pos]) => {
            if (pos.marketId === marketId) {
              pos.claimed = true;
            }
          });
        }

        allTransactions.sort((a, b) => b.timestamp - a.timestamp);

        let totalLost = 0;
        let winCount = 0;
        let lossCount = 0;
        let pendingCount = 0;
        const now = Date.now() / 1000;
        let activeBets = 0;
        const positionsArray = Array.from(positionsMap.values());
        
        for (const pos of positionsArray) {
          if (pos.outcome === 0 && pos.endTime > now) {
            activeBets++;
            pendingCount++;
          } else if (pos.outcome !== 0 && pos.outcome !== 3) {
            const won = (pos.isYes && pos.outcome === 1) || (!pos.isYes && pos.outcome === 2);
            if (won) {
              winCount++;
            } else {
              lossCount++;
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
          activeBets,
          winCount,
          lossCount,
          pendingCount
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
      <div className="min-h-screen bg-background flex-1">
        <Navbar />
        <main className="container mx-auto px-4 py-16">
          <Card className="max-w-lg mx-auto text-center">
            <CardHeader>
              <Wallet className="w-16 h-16 mx-auto text-primary mb-4" />
              <CardTitle>Connect Your Wallet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground">
                Connect wallet to experience prediction on Arc Testnet
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex-1">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold font-display text-primary">Portfolio</h1>
            <p className="text-foreground mt-1">Track your betting activity and performance</p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Wallet className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-foreground uppercase tracking-wider">Balance</p>
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
                        <p className="text-xs text-foreground uppercase tracking-wider">Total Won</p>
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
                        <p className="text-xs text-foreground uppercase tracking-wider">Total Lost</p>
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
                        <p className="text-xs text-foreground uppercase tracking-wider">Active Bets</p>
                        <p className="text-2xl font-bold font-mono">{stats.activeBets}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/20">
                        <Target className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-foreground uppercase tracking-wider">Win Rate</p>
                        <p className="text-2xl font-bold font-mono">{analytics.winRate}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-gradient-to-br ${analytics.netProfit >= 0 ? 'from-green-500/5 to-green-500/10 border-green-500/20' : 'from-red-500/5 to-red-500/10 border-red-500/20'}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${analytics.netProfit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        <BarChart3 className={`w-5 h-5 ${analytics.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                      </div>
                      <div>
                        <p className="text-xs text-foreground uppercase tracking-wider">Net P/L</p>
                        <p className={`text-2xl font-bold font-mono ${analytics.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {analytics.netProfit >= 0 ? '+' : ''}{analytics.netProfit.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-cyan-500/5 to-cyan-500/10 border-cyan-500/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-cyan-500/20">
                        <Percent className="w-5 h-5 text-cyan-500" />
                      </div>
                      <div>
                        <p className="text-xs text-foreground uppercase tracking-wider">ROI</p>
                        <p className="text-2xl font-bold font-mono text-cyan-500">{analytics.roi}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-purple-500/20">
                        <Calendar className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs text-foreground uppercase tracking-wider">Avg Bet</p>
                        <p className="text-2xl font-bold font-mono text-purple-500">${analytics.avgBetSize}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-xs text-foreground uppercase tracking-wider mb-1">Total Deposited</p>
                  <p className="text-xl font-mono font-semibold">${stats.totalDeposited.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-xs text-foreground uppercase tracking-wider mb-1">Total Withdrawn</p>
                  <p className="text-xl font-mono font-semibold">${stats.totalWithdrawn.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-xs text-foreground uppercase tracking-wider mb-1">Total Bet</p>
                  <p className="text-xl font-mono font-semibold">${stats.totalBet.toFixed(2)}</p>
                </div>
              </div>

              <Tabs defaultValue="analytics" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="positions" data-testid="tab-positions">Positions</TabsTrigger>
                  <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="analytics" className="mt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-primary" />
                          Cumulative P/L Over Time
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {chartData.daily.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={chartData.daily}>
                              <defs>
                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                              <Tooltip 
                                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cumulative P/L']}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="cumulative" 
                                stroke="#22c55e" 
                                fillOpacity={1} 
                                fill="url(#colorProfit)" 
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[250px] flex items-center justify-center text-foreground">
                            <p>No betting data yet</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Target className="w-5 h-5 text-primary" />
                          Bet Outcomes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {chartData.pieData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={chartData.pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, value }) => `${name}: ${value}`}
                              >
                                {chartData.pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[250px] flex items-center justify-center text-foreground">
                            <p>No bet outcomes yet</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-primary" />
                          Daily Betting Volume
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {chartData.daily.length > 0 ? (
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData.daily}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                              <Tooltip 
                                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Volume']}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                              />
                              <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[200px] flex items-center justify-center text-foreground">
                            <p>No betting volume data yet</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="positions" className="mt-6">
                  {positions.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center text-foreground">
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
                                    <span className="text-sm text-foreground">
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
                      <CardContent className="py-12 text-center text-foreground">
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
                                  {tx.details && <p className="text-xs text-foreground">{tx.details}</p>}
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
