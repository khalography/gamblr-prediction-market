import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sportsEvents, marketEvents } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { 
  syncFixtures, 
  getUpcomingEvents, 
  linkMarketToEvent,
  getUnresolvedMarketEvents 
} from "./sports-api";
import { runResolutionCycle, startResolutionWorker } from "./resolution-worker";

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

  if (process.env.API_FOOTBALL_KEY && process.env.OWNER_PRIVATE_KEY) {
    console.log("[Server] Starting resolution worker...");
    startResolutionWorker(
      process.env.API_FOOTBALL_KEY,
      process.env.OWNER_PRIVATE_KEY,
      5
    );
  } else {
    console.log("[Server] Resolution worker not started - missing API keys");
  }

  const httpServer = createServer(app);
  return httpServer;
}
