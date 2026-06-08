var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/app.ts
import express from "express";

// server/routes.ts
import { createServer } from "http";

// server/db.ts
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  insertMarketEventSchema: () => insertMarketEventSchema,
  insertMarketRequestSchema: () => insertMarketRequestSchema,
  insertSportsEventSchema: () => insertSportsEventSchema,
  insertUserSchema: () => insertUserSchema,
  marketEvents: () => marketEvents,
  marketRequests: () => marketRequests,
  sportsEvents: () => sportsEvents,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var sportsEvents = pgTable("sports_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  externalId: text("external_id").notNull(),
  league: text("league").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  matchDate: timestamp("match_date").notNull(),
  status: text("status").notNull().default("scheduled"),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  lastUpdated: timestamp("last_updated").defaultNow()
});
var marketEvents = pgTable("market_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marketId: integer("market_id").notNull(),
  eventId: varchar("event_id").notNull(),
  betType: text("bet_type").notNull(),
  targetTeam: text("target_team"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  outcome: integer("outcome"),
  createdAt: timestamp("created_at").defaultNow()
});
var marketRequests = pgTable("market_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var insertSportsEventSchema = createInsertSchema(sportsEvents).omit({
  id: true,
  lastUpdated: true
});
var insertMarketEventSchema = createInsertSchema(marketEvents).omit({
  id: true,
  resolved: true,
  resolvedAt: true,
  outcome: true,
  createdAt: true
});
var insertMarketRequestSchema = createInsertSchema(marketRequests).omit({
  id: true,
  createdAt: true
});

// server/db.ts
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle(pool, { schema: schema_exports });

// server/routes.ts
import { eq as eq2, desc } from "drizzle-orm";

// server/sports-api.ts
import { eq, and } from "drizzle-orm";
var API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
var EPL_LEAGUE_ID = 39;
async function fetchEPLFixtures(apiKey) {
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
  const response = await fetch(
    `${API_FOOTBALL_BASE}/fixtures?league=${EPL_LEAGUE_ID}&season=2024&from=${lastWeek}&to=${nextWeek}`,
    {
      headers: {
        "x-rapidapi-host": "v3.football.api-sports.io",
        "x-rapidapi-key": apiKey
      }
    }
  );
  if (!response.ok) {
    throw new Error(`API-Football error: ${response.status}`);
  }
  const data = await response.json();
  return data.response || [];
}
async function fetchWorldCupFixtures(apiKey) {
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
  const response = await fetch(
    `${API_FOOTBALL_BASE}/fixtures?league=1&season=2026&from=${lastWeek}&to=${nextWeek}`,
    {
      headers: {
        "x-rapidapi-host": "v3.football.api-sports.io",
        "x-rapidapi-key": apiKey
      }
    }
  );
  if (!response.ok) {
    throw new Error(`API-Football World Cup error: ${response.status}`);
  }
  const data = await response.json();
  return data.response || [];
}
async function fetchFixtureById(apiKey, fixtureId) {
  const response = await fetch(
    `${API_FOOTBALL_BASE}/fixtures?id=${fixtureId}`,
    {
      headers: {
        "x-rapidapi-host": "v3.football.api-sports.io",
        "x-rapidapi-key": apiKey
      }
    }
  );
  if (!response.ok) {
    throw new Error(`API-Football error: ${response.status}`);
  }
  const data = await response.json();
  return data.response?.[0] || null;
}
async function refreshLinkedFixtures(apiKey) {
  const unresolvedLinks = await db.select().from(marketEvents).innerJoin(sportsEvents, eq(marketEvents.eventId, sportsEvents.id)).where(eq(marketEvents.resolved, false));
  for (const link of unresolvedLinks) {
    const fixture = await fetchFixtureById(apiKey, link.sports_events.externalId);
    if (fixture) {
      await db.update(sportsEvents).set({
        status: fixture.fixture.status.short,
        homeScore: fixture.goals.home,
        awayScore: fixture.goals.away,
        lastUpdated: /* @__PURE__ */ new Date()
      }).where(eq(sportsEvents.id, link.sports_events.id));
    }
  }
}
async function syncFixtures(apiKey) {
  const eplFixtures = await fetchEPLFixtures(apiKey);
  let wcFixtures = [];
  try {
    wcFixtures = await fetchWorldCupFixtures(apiKey);
    console.log(`[Sports API] Fetched ${wcFixtures.length} World Cup fixtures.`);
  } catch (error) {
    console.error("[Sports API] Failed to fetch World Cup fixtures:", error.message);
  }
  const fixtures = [...eplFixtures, ...wcFixtures];
  for (const fixture of fixtures) {
    const existingEvent = await db.select().from(sportsEvents).where(eq(sportsEvents.externalId, String(fixture.fixture.id))).limit(1);
    const eventData = {
      externalId: String(fixture.fixture.id),
      league: fixture.league.name,
      homeTeam: fixture.teams.home.name,
      awayTeam: fixture.teams.away.name,
      matchDate: new Date(fixture.fixture.date),
      status: fixture.fixture.status.short,
      homeScore: fixture.goals.home,
      awayScore: fixture.goals.away,
      lastUpdated: /* @__PURE__ */ new Date()
    };
    if (existingEvent.length > 0) {
      await db.update(sportsEvents).set(eventData).where(eq(sportsEvents.id, existingEvent[0].id));
    } else {
      await db.insert(sportsEvents).values(eventData);
    }
  }
}
async function getUpcomingEvents() {
  return await db.select().from(sportsEvents).where(
    and(
      eq(sportsEvents.status, "NS")
    )
  ).orderBy(sportsEvents.matchDate);
}
async function linkMarketToEvent(marketId, eventId, betType, targetTeam) {
  return await db.insert(marketEvents).values({
    marketId,
    eventId,
    betType,
    targetTeam
  });
}
async function getUnresolvedMarketEvents() {
  return await db.select({
    marketEvent: marketEvents,
    sportsEvent: sportsEvents
  }).from(marketEvents).innerJoin(sportsEvents, eq(marketEvents.eventId, sportsEvents.id)).where(
    and(
      eq(marketEvents.resolved, false),
      eq(sportsEvents.status, "FT")
    )
  );
}
function determineOutcome(betType, targetTeam, homeTeam, awayTeam, homeScore, awayScore) {
  if (betType === "home_win") {
    return homeScore > awayScore ? 1 : 2;
  } else if (betType === "away_win") {
    return awayScore > homeScore ? 1 : 2;
  } else if (betType === "draw") {
    return homeScore === awayScore ? 1 : 2;
  } else if (betType === "team_win" && targetTeam) {
    if (targetTeam === homeTeam) {
      return homeScore > awayScore ? 1 : 2;
    } else if (targetTeam === awayTeam) {
      return awayScore > homeScore ? 1 : 2;
    }
  }
  return 3;
}
async function markMarketResolved(marketEventId, outcome) {
  await db.update(marketEvents).set({
    resolved: true,
    resolvedAt: /* @__PURE__ */ new Date(),
    outcome
  }).where(eq(marketEvents.id, marketEventId));
}

// server/resolution-worker.ts
import { ethers } from "ethers";
var GAMBLR_ADDRESS = "0x18768Cd75D86E77CddE4B7DD3b222cCB604FDD5c";
var ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";
var GAMBLR_ABI = [
  "function resolveMarket(uint256 _marketId, uint8 _outcome) external",
  "function markets(uint256) view returns (uint256 id, string question, uint256 totalYesAmount, uint256 totalNoAmount, uint8 outcome, bool isResolved, uint256 endTime)",
  "function owner() view returns (address)"
];
var isRunning = false;
var cycleInProgress = false;
var intervalId = null;
async function runResolutionCycle(apiKey, ownerPrivateKey) {
  if (cycleInProgress) {
    console.log("[Resolution] Cycle already in progress, skipping");
    return { synced: 0, resolved: 0, errors: ["Cycle already in progress"] };
  }
  cycleInProgress = true;
  const errors = [];
  let synced = 0;
  let resolved = 0;
  try {
    try {
      await syncFixtures(apiKey);
      synced++;
      console.log("[Resolution] Synced fixtures from API-Football");
    } catch (e) {
      errors.push(`Sync error: ${e.message}`);
      console.error("[Resolution] Failed to sync fixtures:", e.message);
    }
    try {
      await refreshLinkedFixtures(apiKey);
      console.log("[Resolution] Refreshed linked fixtures");
    } catch (e) {
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
      } catch (e) {
        if (e.message?.includes("already resolved") || e.message?.includes("Market is resolved")) {
          console.log(`[Resolution] Market ${marketEvent.marketId} was already resolved, updating DB`);
          try {
            const onChainMarket = await contract.markets(marketEvent.marketId);
            await markMarketResolved(marketEvent.id, Number(onChainMarket.outcome));
            resolved++;
          } catch (dbErr) {
            errors.push(`Market ${marketEvent.marketId} DB sync: ${dbErr.message}`);
          }
        } else {
          errors.push(`Market ${marketEvent.marketId}: ${e.message}`);
          console.error(`[Resolution] Failed to resolve market ${marketEvent.marketId}:`, e.message);
        }
      }
    }
  } catch (e) {
    errors.push(`Resolution error: ${e.message}`);
    console.error("[Resolution] Error in resolution cycle:", e.message);
  } finally {
    cycleInProgress = false;
  }
  return { synced, resolved, errors };
}
function startResolutionWorker(apiKey, ownerPrivateKey, intervalMinutes = 5) {
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
  intervalId = setInterval(run, intervalMinutes * 60 * 1e3);
}

// server/circle.ts
import { randomUUID } from "crypto";
var CIRCLE_API_URL = "https://api.circle.com/v1/w3s";
var CircleService = class {
  apiKey;
  appId;
  isSandbox;
  constructor() {
    this.apiKey = process.env.CIRCLE_API_KEY;
    this.appId = process.env.CIRCLE_APP_ID;
    this.isSandbox = !this.apiKey || !this.appId;
    if (this.isSandbox) {
      console.log("[Circle Service] Running in Sandbox (Mock) mode. Set CIRCLE_API_KEY and CIRCLE_APP_ID in .env to connect to live Circle APIs.");
    } else {
      console.log("[Circle Service] Running in Live mode connected to Circle Web3 Services.");
    }
  }
  /**
   * Registers a new user with Circle Web3 Services
   */
  async createUser(userId) {
    if (this.isSandbox) {
      return { success: true, sandbox: true };
    }
    try {
      const response = await fetch(`${CIRCLE_API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ userId })
      });
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 409 || errorText.includes("already exists")) {
          return { success: true, sandbox: false };
        }
        throw new Error(`Circle createUser failed: ${response.status} - ${errorText}`);
      }
      return { success: true, sandbox: false };
    } catch (error) {
      console.error("Error creating Circle user:", error);
      throw error;
    }
  }
  /**
   * Generates a User Session Token and Encryption Key
   */
  async createUserToken(userId) {
    if (this.isSandbox) {
      return {
        userToken: `mock-user-token-${randomUUID()}`,
        encryptionKey: `mock-encryption-key-${randomUUID()}`,
        sandbox: true
      };
    }
    try {
      const response = await fetch(`${CIRCLE_API_URL}/users/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ userId })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Circle createUserToken failed: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return {
        userToken: data.data.userToken,
        encryptionKey: data.data.encryptionKey,
        sandbox: false
      };
    } catch (error) {
      console.error("Error creating Circle user token:", error);
      throw error;
    }
  }
  /**
   * Initiates a contract execution transaction challenge
   */
  async createContractExecutionChallenge(options) {
    if (this.isSandbox) {
      return {
        challengeId: `mock-challenge-${randomUUID()}`,
        sandbox: true
      };
    }
    try {
      const response = await fetch(`${CIRCLE_API_URL}/user/transactions/contractExecution`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "X-User-Token": options.userId
          // Note: The active user session token is passed in headers
        },
        body: JSON.stringify({
          idempotencyKey: randomUUID(),
          contractAddress: options.contractAddress,
          abiFunctionSignature: options.abiFunctionSignature,
          abiParameters: options.abiParameters,
          feeLevel: options.feeLevel || "MEDIUM"
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Circle contract execution challenge failed: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return {
        challengeId: data.data.challengeId,
        sandbox: false
      };
    } catch (error) {
      console.error("Error creating Circle contract challenge:", error);
      throw error;
    }
  }
  /**
   * Fetches user wallets associated with a userId
   */
  async getUserWallets(userId) {
    if (this.isSandbox) {
      const hashedName = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const hexAddress = "0x8888" + hashedName.toString(16).padStart(36, "0");
      return [{ address: hexAddress }];
    }
    try {
      const response = await fetch(`${CIRCLE_API_URL}/wallets?userId=${userId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Circle getUserWallets failed: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return data.data.wallets || [];
    } catch (error) {
      console.error("Error fetching Circle user wallets:", error);
      return [];
    }
  }
};
var circleService = new CircleService();

// server/routes.ts
async function registerRoutes(app2) {
  app2.get("/api/sports/events", async (req, res) => {
    try {
      const events = await db.select().from(sportsEvents).orderBy(desc(sportsEvents.matchDate)).limit(50);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/sports/upcoming", async (req, res) => {
    try {
      const events = await getUpcomingEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/sports/sync", async (req, res) => {
    try {
      const apiKey = process.env.API_FOOTBALL_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "API_FOOTBALL_KEY not configured" });
      }
      await syncFixtures(apiKey);
      res.json({ success: true, message: "Fixtures synced" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/markets/:marketId/link-event", async (req, res) => {
    try {
      const { marketId } = req.params;
      const { eventId, betType, targetTeam } = req.body;
      if (!eventId || !betType) {
        return res.status(400).json({ error: "eventId and betType are required" });
      }
      await linkMarketToEvent(
        parseInt(marketId),
        eventId,
        betType,
        targetTeam
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/markets/linked", async (req, res) => {
    try {
      const linked = await db.select({
        marketEvent: marketEvents,
        sportsEvent: sportsEvents
      }).from(marketEvents).innerJoin(sportsEvents, eq2(marketEvents.eventId, sportsEvents.id));
      res.json(linked);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/markets/request", async (req, res) => {
    try {
      const { title, category, description } = req.body;
      if (!title || !category) {
        return res.status(400).json({ error: "title and category are required" });
      }
      const [newRequest] = await db.insert(marketRequests).values({
        title,
        category,
        description: description || null
      }).returning();
      res.json(newRequest);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/resolution/run", async (req, res) => {
    try {
      const apiKey = process.env.API_FOOTBALL_KEY;
      const ownerKey = process.env.OWNER_PRIVATE_KEY;
      if (!apiKey || !ownerKey) {
        return res.status(400).json({
          error: "Missing API_FOOTBALL_KEY or OWNER_PRIVATE_KEY"
        });
      }
      const result = await runResolutionCycle(apiKey, ownerKey);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/resolution/pending", async (req, res) => {
    try {
      const pending = await getUnresolvedMarketEvents();
      res.json(pending);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/circle/user", async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }
      await circleService.createUser(username);
      const tokenResponse = await circleService.createUserToken(username);
      const wallets = await circleService.getUserWallets(username);
      const walletAddress = wallets.length > 0 ? wallets[0].address : null;
      res.json({
        ...tokenResponse,
        appId: process.env.CIRCLE_APP_ID || "mock-app-id",
        walletAddress
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/circle/social-auth", async (req, res) => {
    try {
      const { oauthCode, provider } = req.body;
      if (!oauthCode || !provider) {
        return res.status(400).json({ error: "oauthCode and provider are required" });
      }
      const circleResponse = await fetch("https://api.circle.com/v1/w3s/users/social", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.CIRCLE_API_KEY}`
        },
        body: JSON.stringify({ oauthCode, provider })
      });
      if (!circleResponse.ok) {
        const errorText = await circleResponse.text();
        throw new Error(`Circle social exchange failed: ${circleResponse.status} - ${errorText}`);
      }
      const circleData = await circleResponse.json();
      const { userId, userToken, encryptionKey } = circleData.data;
      const wallets = await circleService.getUserWallets(userId);
      const walletAddress = wallets.length > 0 ? wallets[0].address : null;
      res.json({
        userId,
        userToken,
        encryptionKey,
        appId: process.env.CIRCLE_APP_ID || "mock-app-id",
        walletAddress
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/circle/app-id", async (req, res) => {
    res.json({ appId: process.env.CIRCLE_APP_ID || "mock-app-id" });
  });
  app2.post("/api/circle/challenge", async (req, res) => {
    try {
      const { userToken, contractAddress, abiFunctionSignature, abiParameters } = req.body;
      if (!userToken || !contractAddress || !abiFunctionSignature || !abiParameters) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const challengeResponse = await circleService.createContractExecutionChallenge({
        userId: userToken,
        contractAddress,
        abiFunctionSignature,
        abiParameters
      });
      res.json(challengeResponse);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  if (process.env.API_FOOTBALL_KEY && process.env.OWNER_PRIVATE_KEY && !process.env.VERCEL) {
    console.log("[Server] Starting resolution worker...");
    startResolutionWorker(
      process.env.API_FOOTBALL_KEY,
      process.env.OWNER_PRIVATE_KEY,
      5
    );
  } else {
    console.log("[Server] Resolution worker not started - missing API keys or running in serverless environment");
  }
  const httpServer = createServer(app2);
  return httpServer;
}

// server/app.ts
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
var app = express();
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});

// server/api.ts
process.env.NODE_ENV = "production";
registerRoutes(app).catch((err) => {
  console.error("Failed to register routes in serverless context:", err);
});
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});
var api_default = app;
export {
  api_default as default
};
