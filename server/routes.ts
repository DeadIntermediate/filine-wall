import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { desc, eq, sql } from "drizzle-orm";
import { phoneNumbers, callLogs } from "@db/schema";
import { screenCall, logCall } from "./services/callScreening";

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

  // Get daily statistics with dynamic date range
  app.get("/api/stats/daily", async (req, res) => {
    const days = parseInt(req.query.days as string) || 7;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await db
      .select({
        date: sql<string>`DATE(${callLogs.timestamp})`,
        blocked: sql<number>`count(*) filter (where ${callLogs.action} = 'blocked')`,
        allowed: sql<number>`count(*) filter (where ${callLogs.action} = 'allowed')`,
      })
      .from(callLogs)
      .where(sql`${callLogs.timestamp} >= ${startDate} AND ${callLogs.timestamp} <= ${endDate}`)
      .groupBy(sql`DATE(${callLogs.timestamp})`)
      .orderBy(sql`DATE(${callLogs.timestamp})`);

    res.json({ daily: stats });
  });

  // Get call distribution statistics
  app.get("/api/stats/distribution", async (req, res) => {
    // Hourly distribution
    const hourlyStats = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${callLogs.timestamp})::integer`,
        count: sql<number>`count(*)`,
      })
      .from(callLogs)
      .groupBy(sql`EXTRACT(HOUR FROM ${callLogs.timestamp})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${callLogs.timestamp})`);

    // Call types distribution
    const typeStats = await db
      .select({
        name: callLogs.action,
        value: sql<number>`count(*)`,
      })
      .from(callLogs)
      .groupBy(callLogs.action);

    res.json({
      hourly: hourlyStats,
      types: typeStats,
    });
  });

  // Screen call
  app.post("/api/screen", async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    try {
      const result = await screenCall(phoneNumber);
      await logCall(phoneNumber, result);
      res.json(result);
    } catch (error) {
      console.error("Error screening call:", error);
      res.status(500).json({ message: "Error screening call" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}