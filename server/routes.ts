import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { desc, eq, sql } from "drizzle-orm";
import { phoneNumbers, callLogs } from "@db/schema";

export function registerRoutes(app: Express): Server {
  // Get all phone numbers
  app.get("/api/numbers", async (req, res) => {
    const numbers = await db.query.phoneNumbers.findMany({
      orderBy: desc(phoneNumbers.createdAt),
    });
    res.json(numbers);
  });

  // Add new phone number
  app.post("/api/numbers", async (req, res) => {
    const { number, type } = req.body;
    const result = await db.insert(phoneNumbers).values({
      number,
      type,
    }).returning();
    res.json(result[0]);
  });

  // Delete phone number
  app.delete("/api/numbers/:id", async (req, res) => {
    const { id } = req.params;
    await db.delete(phoneNumbers).where(eq(phoneNumbers.id, parseInt(id)));
    res.json({ success: true });
  });

  // Get call logs
  app.get("/api/calls", async (req, res) => {
    const logs = await db.query.callLogs.findMany({
      orderBy: desc(callLogs.timestamp),
      limit: 100,
    });
    res.json(logs);
  });

  // Get statistics
  app.get("/api/stats", async (req, res) => {
    const [totalBlocked] = await db
      .select({ count: sql<number>`count(*)` })
      .from(callLogs)
      .where(eq(callLogs.action, "blocked"));

    const [blacklistedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(phoneNumbers)
      .where(eq(phoneNumbers.type, "blacklist"));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayBlocks] = await db
      .select({ count: sql<number>`count(*)` })
      .from(callLogs)
      .where(sql`${callLogs.timestamp} >= ${today}`);

    res.json({
      totalBlocked: totalBlocked.count,
      blacklistedCount: blacklistedCount.count,
      todayBlocks: todayBlocks.count,
    });
  });

  // Get daily statistics
  app.get("/api/stats/daily", async (req, res) => {
    const days = 7;
    const stats = await db
      .select({
        date: sql<string>`date_trunc('day', ${callLogs.timestamp})`,
        blocked: sql<number>`count(*) filter (where ${callLogs.action} = 'blocked')`,
        allowed: sql<number>`count(*) filter (where ${callLogs.action} = 'allowed')`,
      })
      .from(callLogs)
      .where(sql`${callLogs.timestamp} >= now() - interval '${days} days'`)
      .groupBy(sql`date_trunc('day', ${callLogs.timestamp})`)
      .orderBy(sql`date_trunc('day', ${callLogs.timestamp})`);

    res.json({ daily: stats });
  });

  const httpServer = createServer(app);
  return httpServer;
}
