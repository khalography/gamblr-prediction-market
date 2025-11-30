import { db } from "./db";
import { sportsEvents, marketEvents } from "@shared/schema";
import { eq, and, lt, isNull } from "drizzle-orm";

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const EPL_LEAGUE_ID = 39;

interface APIFixture {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;
      long: string;
    };
  };
  league: {
    id: number;
    name: string;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

export async function fetchEPLFixtures(apiKey: string): Promise<APIFixture[]> {
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const response = await fetch(
    `${API_FOOTBALL_BASE}/fixtures?league=${EPL_LEAGUE_ID}&season=2024&from=${lastWeek}&to=${nextWeek}`,
    {
      headers: {
        'x-rapidapi-host': 'v3.football.api-sports.io',
        'x-rapidapi-key': apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`API-Football error: ${response.status}`);
  }

  const data = await response.json();
  return data.response || [];
}

export async function fetchFixtureById(apiKey: string, fixtureId: string): Promise<APIFixture | null> {
  const response = await fetch(
    `${API_FOOTBALL_BASE}/fixtures?id=${fixtureId}`,
    {
      headers: {
        'x-rapidapi-host': 'v3.football.api-sports.io',
        'x-rapidapi-key': apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`API-Football error: ${response.status}`);
  }

  const data = await response.json();
  return data.response?.[0] || null;
}

export async function refreshLinkedFixtures(apiKey: string): Promise<void> {
  const unresolvedLinks = await db
    .select()
    .from(marketEvents)
    .innerJoin(sportsEvents, eq(marketEvents.eventId, sportsEvents.id))
    .where(eq(marketEvents.resolved, false));

  for (const link of unresolvedLinks) {
    const fixture = await fetchFixtureById(apiKey, link.sports_events.externalId);
    if (fixture) {
      await db
        .update(sportsEvents)
        .set({
          status: fixture.fixture.status.short,
          homeScore: fixture.goals.home,
          awayScore: fixture.goals.away,
          lastUpdated: new Date(),
        })
        .where(eq(sportsEvents.id, link.sports_events.id));
    }
  }
}

export async function syncFixtures(apiKey: string): Promise<void> {
  const fixtures = await fetchEPLFixtures(apiKey);
  
  for (const fixture of fixtures) {
    const existingEvent = await db
      .select()
      .from(sportsEvents)
      .where(eq(sportsEvents.externalId, String(fixture.fixture.id)))
      .limit(1);

    const eventData = {
      externalId: String(fixture.fixture.id),
      league: fixture.league.name,
      homeTeam: fixture.teams.home.name,
      awayTeam: fixture.teams.away.name,
      matchDate: new Date(fixture.fixture.date),
      status: fixture.fixture.status.short,
      homeScore: fixture.goals.home,
      awayScore: fixture.goals.away,
      lastUpdated: new Date(),
    };

    if (existingEvent.length > 0) {
      await db
        .update(sportsEvents)
        .set(eventData)
        .where(eq(sportsEvents.id, existingEvent[0].id));
    } else {
      await db.insert(sportsEvents).values(eventData);
    }
  }
}

export async function getUpcomingEvents() {
  return await db
    .select()
    .from(sportsEvents)
    .where(
      and(
        eq(sportsEvents.status, "NS"),
      )
    )
    .orderBy(sportsEvents.matchDate);
}

export async function getFinishedEvents() {
  return await db
    .select()
    .from(sportsEvents)
    .where(eq(sportsEvents.status, "FT"));
}

export async function linkMarketToEvent(
  marketId: number,
  eventId: string,
  betType: "home_win" | "away_win" | "draw",
  targetTeam?: string
) {
  return await db.insert(marketEvents).values({
    marketId,
    eventId,
    betType,
    targetTeam,
  });
}

export async function getUnresolvedMarketEvents() {
  return await db
    .select({
      marketEvent: marketEvents,
      sportsEvent: sportsEvents,
    })
    .from(marketEvents)
    .innerJoin(sportsEvents, eq(marketEvents.eventId, sportsEvents.id))
    .where(
      and(
        eq(marketEvents.resolved, false),
        eq(sportsEvents.status, "FT")
      )
    );
}

export function determineOutcome(
  betType: string,
  targetTeam: string | null,
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number
): number {
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

export async function markMarketResolved(marketEventId: string, outcome: number) {
  await db
    .update(marketEvents)
    .set({
      resolved: true,
      resolvedAt: new Date(),
      outcome,
    })
    .where(eq(marketEvents.id, marketEventId));
}
