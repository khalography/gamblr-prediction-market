import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const sportsEvents = pgTable("sports_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  externalId: text("external_id").notNull(),
  league: text("league").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  matchDate: timestamp("match_date").notNull(),
  status: text("status").notNull().default("scheduled"),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const marketEvents = pgTable("market_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marketId: integer("market_id").notNull(),
  eventId: varchar("event_id").notNull(),
  betType: text("bet_type").notNull(),
  targetTeam: text("target_team"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  outcome: integer("outcome"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertSportsEventSchema = createInsertSchema(sportsEvents).omit({
  id: true,
  lastUpdated: true,
});

export const insertMarketEventSchema = createInsertSchema(marketEvents).omit({
  id: true,
  resolved: true,
  resolvedAt: true,
  outcome: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SportsEvent = typeof sportsEvents.$inferSelect;
export type InsertSportsEvent = z.infer<typeof insertSportsEventSchema>;
export type MarketEvent = typeof marketEvents.$inferSelect;
export type InsertMarketEvent = z.infer<typeof insertMarketEventSchema>;
