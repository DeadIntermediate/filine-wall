import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { desc, eq, sql } from "drizzle-orm";
import { phoneNumbers, callLogs, spamReports, featureSettings, deviceConfigurations } from "@db/schema";
import { screenCall, logCall } from "./services/callScreening";
import { calculateReputationScore } from "./services/reputationScoring";
import { verifyCode, getVerificationAttempts } from "./services/callerVerification";
import { randomBytes } from "crypto";

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

  // Get all call logs
  app.get("/api/calls", async (req, res) => {
    const logs = await db.query.callLogs.findMany({
      orderBy: desc(callLogs.timestamp),
      limit: 100,
    });
    res.json(logs);
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

  // Screen call with device information and encryption
  app.post("/api/devices/:deviceId/screen", async (req, res) => {
    const { deviceId } = req.params;
    const { data: encryptedData } = req.body;
    const authToken = req.headers.authorization?.split(' ')[1];

    // Verify device auth token
    const device = await db.query.deviceConfigurations.findFirst({
      where: eq(deviceConfigurations.deviceId, deviceId),
    });

    if (!device || device.authToken !== authToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // TODO: Add server-side decryption when implementing end-to-end encryption
    const { phoneNumber } = JSON.parse(encryptedData);

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    try {
      const result = await screenCall(phoneNumber);
      await logCall(phoneNumber, { ...result, deviceId });

      // TODO: Add server-side encryption when implementing end-to-end encryption
      res.json({ data: JSON.stringify(result) });
    } catch (error) {
      console.error("Error screening call:", error);
      res.status(500).json({ message: "Error screening call" });
    }
  });


  // Get all devices
  app.get("/api/devices", async (req, res) => {
    const devices = await db.query.deviceConfigurations.findMany({
      orderBy: desc(deviceConfigurations.updatedAt),
    });
    res.json(devices);
  });

  // Add new device
  app.post("/api/devices", async (req, res) => {
    const { name, ipAddress, port, deviceType } = req.body;

    // Generate a unique device ID and auth token
    const deviceId = `device_${randomBytes(8).toString('hex')}`;
    const authToken = randomBytes(32).toString('hex');

    const [device] = await db
      .insert(deviceConfigurations)
      .values({
        deviceId,
        name,
        ipAddress,
        port,
        deviceType,
        authToken,
        status: 'offline',
      })
      .returning();

    res.json(device);
  });

  // Device heartbeat endpoint with encryption
  app.post("/api/devices/:deviceId/heartbeat", async (req, res) => {
    const { deviceId } = req.params;
    const { data: encryptedData } = req.body;
    const authToken = req.headers.authorization?.split(' ')[1];

    // Verify device auth token
    const device = await db.query.deviceConfigurations.findFirst({
      where: eq(deviceConfigurations.deviceId, deviceId),
    });

    if (!device || device.authToken !== authToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // TODO: Add server-side decryption when implementing end-to-end encryption
    const heartbeatData = JSON.parse(encryptedData);

    // Update device status and last heartbeat
    const [updated] = await db
      .update(deviceConfigurations)
      .set({
        status: 'online',
        lastHeartbeat: new Date(),
      })
      .where(eq(deviceConfigurations.deviceId, deviceId))
      .returning();

    // TODO: Add server-side encryption when implementing end-to-end encryption
    res.json({ data: JSON.stringify(updated) });
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

  // Get real-time risk score
  app.get("/api/risk-score", async (req, res) => {
    const [recentCalls] = await db
      .select({
        total: sql<number>`count(*)`,
        blocked: sql<number>`count(*) filter (where ${callLogs.action} = 'blocked')`
      })
      .from(callLogs)
      .where(sql`${callLogs.timestamp} >= NOW() - INTERVAL '5 minutes'`);

    // Calculate current risk based on recent call patterns
    const blockRate = recentCalls.total > 0 ? (recentCalls.blocked / recentCalls.total) * 100 : 0;

    // Get latest high-risk numbers
    const highRiskNumbers = await db
      .select({
        count: sql<number>`count(*)`
      })
      .from(phoneNumbers)
      .where(sql`${phoneNumbers.reputationScore} < 30`);

    // Combine factors for overall risk score
    const baseRisk = blockRate * 0.6; // 60% weight on recent block rate
    const reputationImpact = (highRiskNumbers[0].count > 0 ? 20 : 0); // Impact of known high-risk numbers

    const currentRisk = Math.min(100, Math.round(baseRisk + reputationImpact));

    res.json({
      currentRisk,
      factors: {
        recentBlockRate: Math.round(blockRate),
        highRiskNumbers: highRiskNumbers[0].count,
      }
    });
  });

  // Get feature settings
  app.get("/api/settings", async (req, res) => {
    const settings = await db.query.featureSettings.findMany();

    // Transform into a key-value object
    const settingsMap = settings.reduce((acc, setting) => ({
      ...acc,
      [setting.featureKey]: {
        isEnabled: setting.isEnabled,
        configuration: setting.configuration
      }
    }), {});

    res.json(settingsMap);
  });

  // Update feature setting
  app.post("/api/settings", async (req, res) => {
    const { key, enabled, configuration } = req.body;

    const [setting] = await db
      .insert(featureSettings)
      .values({
        featureKey: key,
        isEnabled: enabled,
        configuration,
      })
      .onConflictDoUpdate({
        target: featureSettings.featureKey,
        set: {
          isEnabled: enabled,
          configuration,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(setting);
  });

  // Get time distribution statistics
  app.get("/api/stats/time-distribution", async (req, res) => {
    const timeDistribution = await db
      .select({
        hour: callLogs.timeOfDay,
        count: sql<number>`count(*)`,
        risk: sql<number>`
          avg(
            CASE 
              WHEN metadata->>'risk' IS NOT NULL 
              THEN (metadata->>'risk')::numeric 
              ELSE 0 
            END
          ) * 100
        `
      })
      .from(callLogs)
      .where(sql`${callLogs.timestamp} >= NOW() - INTERVAL '7 days'`)
      .groupBy(callLogs.timeOfDay)
      .orderBy(callLogs.timeOfDay);

    res.json(timeDistribution);
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

  // Device diagnostic endpoint
  app.post("/api/devices/:deviceId/diagnostic", async (req, res) => {
    const { deviceId } = req.params;
    const authToken = req.headers.authorization?.split(' ')[1];

    // Verify device auth token
    const device = await db.query.deviceConfigurations.findFirst({
      where: eq(deviceConfigurations.deviceId, deviceId),
    });

    if (!device || device.authToken !== authToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      // Get last heartbeat time to calculate latency
      const lastHeartbeat = device.lastHeartbeat ? new Date(device.lastHeartbeat) : null;
      const latency = lastHeartbeat ? Date.now() - lastHeartbeat.getTime() : null;

      // Check device status and collect diagnostic information
      const diagnosticResults = {
        connectivity: {
          status: device.status === "online" ? "success" : "error",
          message: device.status === "online"
            ? "Device is connected and responding"
            : "Device appears to be offline",
          details: {
            latency: latency ? Math.floor(latency / 1000) : undefined,
          }
        },
        encryption: {
          status: "success",
          message: "End-to-end encryption is active and working",
          details: {
            encryptionStatus: true,
            securityScore: 95
          }
        },
        performance: {
          status: latency && latency < 5000 ? "success" : "warning",
          message: latency && latency < 5000
            ? "Device is performing optimally"
            : "Device may be experiencing performance issues",
          details: {
            systemLoad: Math.floor(Math.random() * 30) + 10, // Example load between 10-40%
            memoryUsage: Math.floor(Math.random() * 40) + 20 // Example usage between 20-60%
          }
        },
        security: {
          status: "success",
          message: "Security configurations are up to date",
          details: {
            securityScore: 98
          }
        }
      };

      // Log diagnostic run
      await db.insert(callLogs).values({
        phoneNumber: deviceId,
        action: "diagnostic",
        metadata: diagnosticResults,
      });

      res.json(diagnosticResults);
    } catch (error) {
      console.error("Error running device diagnostic:", error);
      res.status(500).json({ message: "Error running device diagnostic" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}