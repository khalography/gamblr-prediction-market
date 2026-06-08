import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sportsEvents, marketEvents, marketRequests } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { 
  syncFixtures, 
  getUpcomingEvents, 
  linkMarketToEvent,
  getUnresolvedMarketEvents 
} from "./sports-api";
import { runResolutionCycle, startResolutionWorker } from "./resolution-worker";
import { circleService } from "./circle";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/sports/events", async (req, res) => {
    try {
      const events = await db
        .select()
        .from(sportsEvents)
        .orderBy(desc(sportsEvents.matchDate))
        .limit(50);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sports/upcoming", async (req, res) => {
    try {
      const events = await getUpcomingEvents();
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sports/sync", async (req, res) => {
    try {
      const apiKey = process.env.API_FOOTBALL_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "API_FOOTBALL_KEY not configured" });
      }
      await syncFixtures(apiKey);
      res.json({ success: true, message: "Fixtures synced" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/markets/:marketId/link-event", async (req, res) => {
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/markets/linked", async (req, res) => {
    try {
      const linked = await db
        .select({
          marketEvent: marketEvents,
          sportsEvent: sportsEvents,
        })
        .from(marketEvents)
        .innerJoin(sportsEvents, eq(marketEvents.eventId, sportsEvents.id));
      res.json(linked);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/markets/request", async (req, res) => {
    try {
      const { title, category, description } = req.body;
      if (!title || !category) {
        return res.status(400).json({ error: "title and category are required" });
      }
      const [newRequest] = await db
        .insert(marketRequests)
        .values({
          title,
          category,
          description: description || null
        })
        .returning();
      res.json(newRequest);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/resolution/run", async (req, res) => {
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/resolution/pending", async (req, res) => {
    try {
      const pending = await getUnresolvedMarketEvents();
      res.json(pending);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Circle Web3 Programmable Wallets endpoints
  app.post("/api/circle/user", async (req, res) => {
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/circle/social-auth", async (req, res) => {
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/circle/app-id", async (req, res) => {
    res.json({ appId: process.env.CIRCLE_APP_ID || "mock-app-id" });
  });

  app.post("/api/circle/challenge", async (req, res) => {
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
    } catch (error: any) {
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

  const httpServer = createServer(app);
  return httpServer;
}
