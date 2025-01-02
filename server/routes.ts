import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { desc, eq, sql } from "drizzle-orm";
import { phoneNumbers, callLogs, spamReports } from "@db/schema";
import { screenCall, logCall } from "./services/callScreening";
import { calculateReputationScore } from "./services/reputationScoring";
import { verifyCode, getVerificationAttempts } from "./services/callerVerification";

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
    const { number, type, description } = req.body;
    const result = await db
      .insert(phoneNumbers)
      .values({
        number,
        type,
        description,
      })
      .returning();
    res.json(result[0]);
  });

  // Delete phone number
  app.delete("/api/numbers/:id", async (req, res) => {
    const { id } = req.params;
    await db.delete(phoneNumbers).where(eq(phoneNumbers.id, parseInt(id)));
    res.json({ success: true });
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

  // Get calls heatmap data
  app.get("/api/calls/heatmap", async (req, res) => {
    const timeRange = parseInt(req.query.range as string) || 24; // Default to last 24 hours
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - timeRange);

    const heatmapData = await db
      .select({
        latitude: callLogs.latitude,
        longitude: callLogs.longitude,
        count: sql<number>`count(*)`,
      })
      .from(callLogs)
      .where(sql`${callLogs.timestamp} >= ${startTime}`)
      .groupBy(callLogs.latitude, callLogs.longitude)
      .having(sql`${callLogs.latitude} is not null and ${callLogs.longitude} is not null`);

    // Transform into heatmap format
    const locations = heatmapData.map(point => ({
      lat: Number(point.latitude),
      long: Number(point.longitude),
      intensity: Math.min(100, (point.count / Math.max(...heatmapData.map(p => p.count))) * 100)
    }));

    res.json(locations);
  });

  // Get all spam reports
  app.get("/api/reports", async (req, res) => {
    const reports = await db
      .select()
      .from(spamReports)
      .orderBy(desc(spamReports.confirmations), desc(spamReports.reportedAt));
    res.json(reports);
  });

  // Submit new spam report
  app.post("/api/reports", async (req, res) => {
    const { phoneNumber, category, description } = req.body;

    // Check if report already exists
    const existingReport = await db.query.spamReports.findFirst({
      where: eq(spamReports.phoneNumber, phoneNumber),
    });

    if (existingReport) {
      // Update existing report with new confirmation
      const [updated] = await db
        .update(spamReports)
        .set({
          confirmations: sql`${spamReports.confirmations} + 1`,
          status: existingReport.confirmations >= 2 ? "verified" : "pending",
        })
        .where(eq(spamReports.id, existingReport.id))
        .returning();

      res.json(updated);
    } else {
      // Create new report
      const [report] = await db
        .insert(spamReports)
        .values({
          phoneNumber,
          category,
          description,
          status: "pending",
          metadata: { originalReport: { category, description } },
        })
        .returning();

      res.json(report);
    }
  });

  // Confirm existing report
  app.post("/api/reports/:id/confirm", async (req, res) => {
    const { id } = req.params;

    const [updated] = await db
      .update(spamReports)
      .set({
        confirmations: sql`${spamReports.confirmations} + 1`,
        status: sql`CASE 
          WHEN ${spamReports.confirmations} + 1 >= 3 THEN 'verified'
          ELSE ${spamReports.status}
        END`,
      })
      .where(eq(spamReports.id, parseInt(id)))
      .returning();

    // If report is verified, automatically add to blacklist
    if (updated.status === "verified") {
      await db
        .insert(phoneNumbers)
        .values({
          number: updated.phoneNumber,
          type: "blacklist",
          description: `Automatically blocked based on community reports. Category: ${updated.category}`,
        })
        .onConflictDoUpdate({
          target: phoneNumbers.number,
          set: {
            type: "blacklist",
            description: `Automatically blocked based on community reports. Category: ${updated.category}`,
          },
        });
    }

    res.json(updated);
  });

  // Get reputation score for a phone number
  app.get("/api/numbers/:number/reputation", async (req, res) => {
    const { number } = req.params;

    try {
      const reputation = await calculateReputationScore(number);
      res.json(reputation);
    } catch (error) {
      console.error("Error calculating reputation score:", error);
      res.status(500).json({ message: "Error calculating reputation score" });
    }
  });

  // Update reputation score (recalculate)
  app.post("/api/numbers/:number/reputation/refresh", async (req, res) => {
    const { number } = req.params;

    try {
      const reputation = await calculateReputationScore(number);
      res.json(reputation);
    } catch (error) {
      console.error("Error refreshing reputation score:", error);
      res.status(500).json({ message: "Error refreshing reputation score" });
    }
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

  // Verify caller identity
  app.post("/api/verify", async (req, res) => {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({ message: "Phone number and verification code are required" });
    }

    // Check for too many attempts
    const attempts = await getVerificationAttempts(phoneNumber);
    if (attempts >= 5) {
      return res.status(429).json({
        message: "Too many verification attempts. Please try again after 24 hours."
      });
    }

    try {
      const result = await verifyCode(phoneNumber, code);
      res.json(result);
    } catch (error) {
      console.error("Error verifying caller:", error);
      res.status(500).json({ message: "Error verifying caller" });
    }
  });

  // Get verification status
  app.get("/api/verify/:phoneNumber/status", async (req, res) => {
    const { phoneNumber } = req.params;

    const [number] = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.number, phoneNumber));

    res.json({
      isVerified: number?.type === "whitelist",
      verifiedAt: number?.createdAt,
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}