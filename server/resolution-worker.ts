import { ethers } from "ethers";
import { 
  syncFixtures,
  refreshLinkedFixtures,
  getUnresolvedMarketEvents, 
  determineOutcome, 
  markMarketResolved 
} from "./sports-api";

const GAMBLR_ADDRESS = "0x18768Cd75D86E77CddE4B7DD3b222cCB604FDD5c";
const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";

const GAMBLR_ABI = [
  "function resolveMarket(uint256 _marketId, uint8 _outcome) external",
  "function markets(uint256) view returns (uint256 id, string question, uint256 totalYesAmount, uint256 totalNoAmount, uint8 outcome, bool isResolved, uint256 endTime)",
  "function owner() view returns (address)"
];

let isRunning = false;
let cycleInProgress = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

export async function runResolutionCycle(
  apiKey: string, 
  ownerPrivateKey: string
): Promise<{ synced: number; resolved: number; errors: string[] }> {
  if (cycleInProgress) {
    console.log("[Resolution] Cycle already in progress, skipping");
    return { synced: 0, resolved: 0, errors: ["Cycle already in progress"] };
  }

  cycleInProgress = true;
  const errors: string[] = [];
  let synced = 0;
  let resolved = 0;

  try {
    try {
      await syncFixtures(apiKey);
      synced++;
      console.log("[Resolution] Synced fixtures from API-Football");
    } catch (e: any) {
      errors.push(`Sync error: ${e.message}`);
      console.error("[Resolution] Failed to sync fixtures:", e.message);
    }

    try {
      await refreshLinkedFixtures(apiKey);
      console.log("[Resolution] Refreshed linked fixtures");
    } catch (e: any) {
      errors.push(`Refresh error: ${e.message}`);
      console.error("[Resolution] Failed to refresh linked fixtures:", e.message);
    }

    const unresolvedMarkets = await getUnresolvedMarketEvents();
    console.log(`[Resolution] Found ${unresolvedMarkets.length} unresolved markets`);

    if (unresolvedMarkets.length === 0) {
      return { synced, resolved, errors };
    }

    const provider = new ethers.JsonRpcProvider(ARC_TESTNET_RPC);
    const wallet = new ethers.Wallet(ownerPrivateKey, provider);
    const contract = new ethers.Contract(GAMBLR_ADDRESS, GAMBLR_ABI, wallet);

    const contractOwner = await contract.owner();
    if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      errors.push("Wallet is not the contract owner");
      return { synced, resolved, errors };
    }

    for (const { marketEvent, sportsEvent } of unresolvedMarkets) {
      try {
        if (sportsEvent.homeScore === null || sportsEvent.awayScore === null) {
          console.log(`[Resolution] Skipping market ${marketEvent.marketId} - no scores yet`);
          continue;
        }

        const onChainMarket = await contract.markets(marketEvent.marketId);
        if (onChainMarket.isResolved) {
          console.log(`[Resolution] Market ${marketEvent.marketId} already resolved on-chain, updating DB`);
          await markMarketResolved(marketEvent.id, Number(onChainMarket.outcome));
          resolved++;
          continue;
        }

        const outcome = determineOutcome(
          marketEvent.betType,
          marketEvent.targetTeam,
          sportsEvent.homeTeam,
          sportsEvent.awayTeam,
          sportsEvent.homeScore,
          sportsEvent.awayScore
        );

        console.log(`[Resolution] Resolving market ${marketEvent.marketId} with outcome ${outcome}`);
        
        const tx = await contract.resolveMarket(marketEvent.marketId, outcome);
        await tx.wait();

        await markMarketResolved(marketEvent.id, outcome);
        resolved++;
        
        console.log(`[Resolution] Market ${marketEvent.marketId} resolved successfully`);
      } catch (e: any) {
        if (e.message?.includes("already resolved") || e.message?.includes("Market is resolved")) {
          console.log(`[Resolution] Market ${marketEvent.marketId} was already resolved, updating DB`);
          try {
            const onChainMarket = await contract.markets(marketEvent.marketId);
            await markMarketResolved(marketEvent.id, Number(onChainMarket.outcome));
            resolved++;
          } catch (dbErr: any) {
            errors.push(`Market ${marketEvent.marketId} DB sync: ${dbErr.message}`);
          }
        } else {
          errors.push(`Market ${marketEvent.marketId}: ${e.message}`);
          console.error(`[Resolution] Failed to resolve market ${marketEvent.marketId}:`, e.message);
        }
      }
    }
  } catch (e: any) {
    errors.push(`Resolution error: ${e.message}`);
    console.error("[Resolution] Error in resolution cycle:", e.message);
  } finally {
    cycleInProgress = false;
  }

  return { synced, resolved, errors };
}

export function startResolutionWorker(
  apiKey: string, 
  ownerPrivateKey: string, 
  intervalMinutes: number = 5
) {
  if (isRunning) {
    console.log("[Resolution] Worker already running");
    return;
  }

  isRunning = true;
  console.log(`[Resolution] Starting worker with ${intervalMinutes} minute interval`);

  const run = async () => {
    if (!isRunning) return;
    
    console.log("[Resolution] Running resolution cycle...");
    const result = await runResolutionCycle(apiKey, ownerPrivateKey);
    console.log(`[Resolution] Cycle complete: synced=${result.synced}, resolved=${result.resolved}, errors=${result.errors.length}`);
  };

  run();

  intervalId = setInterval(run, intervalMinutes * 60 * 1000);
}

export function stopResolutionWorker() {
  isRunning = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  console.log("[Resolution] Worker stopped");
}
