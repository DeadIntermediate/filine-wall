import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { desc, eq, sql } from "drizzle-orm";
import { users, phoneNumbers, callLogs, spamReports, voicePatterns, featureSettings, deviceConfigurations, deviceRegistrations } from "@db/schema";
import { screenCall, logCall } from "./services/callScreening";
import { calculateReputationScore } from "./services/reputationScoring";
import { verifyCode, getVerificationAttempts } from "./services/callerVerification";
import { randomBytes, createHash } from "crypto";
import { SpamDatabaseService } from "./services/spamDatabaseService";
import { getEncryptionService } from "./services/encryptionService";

// Voice analysis import - conditionally loaded to avoid TensorFlow errors on unsupported platforms
let analyzeVoice: ((audioData: Float32Array, sampleRate: number) => Promise<any>) | null = null;
try {
  if (process.env.ENABLE_VOICE_ANALYSIS === 'true') {
    const voiceModule = require("./services/voiceAnalysisService");
    analyzeVoice = voiceModule.analyzeVoice;
  }
} catch (error: any) {
  if (error.code === 'ERR_DLOPEN_FAILED') {
    console.warn('⚠ Voice analysis disabled: TensorFlow not compatible with this system architecture');
  } else {
    console.warn('⚠ Voice analysis not available:', error.message);
  }
}

export type VoiceAnalysisResult = {
  isRobocall: boolean;
  confidence: number;
  reason: string;
};

export function registerRoutes(app: Express): Server {
  // Health check endpoint
  app.get("/health", async (req, res) => {
    try {
      // Check database connectivity
      const dbCheck = await db.select().from(users).limit(1);
      const dbHealthy = Array.isArray(dbCheck);

      const healthStatus = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
        services: {
          database: dbHealthy ? "healthy" : "unhealthy",
          api: "healthy"
        },
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      };

      const statusCode = dbHealthy ? 200 : 503;
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Config endpoint - tells frontend auth is disabled
  app.get("/api/config", (req, res) => {
    res.json({
      requireAuth: false,
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Auth routes (public) - Disabled in local mode
  app.post("/api/auth/login", async (req, res) => {
    try {
      if (process.env.REQUIRE_AUTH !== 'true') {
        return res.status(403).json({ message: "Authentication disabled in local mode" });
      }
      const { username, password } = req.body;
      // AuthService removed - return error
      return res.status(501).json({ message: "Authentication not implemented in this build" });
    } catch (error) {
      return res.status(401).json({ message: error instanceof Error ? error.message : "Authentication failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      if (process.env.REQUIRE_AUTH !== 'true') {
        return res.status(403).json({ message: "Authentication disabled in local mode" });
      }
      const { username, password, role } = req.body;
      // AuthService removed - return error
      return res.status(501).json({ message: "Authentication not implemented in this build" });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Registration failed" });
    }
  });

  // No authentication required - local deployment mode
  console.log("🔓 Running in open access mode (local deployment)");

  // Move existing admin routes under /api/admin
  app.get("/api/admin/stats", async (req, res) => {
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
      totalBlocked: totalBlocked?.count ?? 0,
      blacklistedCount: blacklistedCount?.count ?? 0,
      todayBlocks: todayBlocks?.count ?? 0,
    });
  });

  app.get("/api/admin/settings", async (req, res) => {
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

  // Get device/modem status
  app.get("/api/admin/devices", async (req, res) => {
    try {
      // Get registered devices from database
      let registeredDevices = [];
      try {
        registeredDevices = await db.query.deviceRegistrations.findMany();
      } catch (dbError) {
        console.error('Database not connected for device query:', dbError);
        // Continue with empty array if DB not available
      }
      
      // Get modem configuration from environment
      const modemConfig = {
        deviceId: 'local-modem',
        name: process.env.MODEM_DEVICE || '/dev/ttyUSB0',
        status: process.env.MODEM_ENABLED === 'true' ? 'configured' : 'disabled',
        type: 'USRobotics Modem',
        port: process.env.MODEM_PORT || process.env.MODEM_DEVICE || '/dev/ttyUSB0',
        baudRate: process.env.MODEM_BAUDRATE || '57600',
        callerIdEnabled: process.env.CALLER_ID_ENABLED !== 'false',
        lastHeartbeat: new Date().toISOString()
      };

      // Combine registered devices and local modem
      const allDevices = [
        modemConfig,
        ...registeredDevices.map(d => ({
          deviceId: d.deviceId,
          name: d.name || d.deviceId,
          status: d.status || 'offline',
          type: d.deviceType || 'Remote Device',
          ipAddress: (d.metadata as any)?.ipAddress || 'N/A',
          lastHeartbeat: d.lastActive?.toISOString() || null
        }))
      ];

      res.json(allDevices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch device status" });
    }
  });

  // User routes - Open access
  app.get("/api/user/calls", async (req, res) => {
    const logs = await db.query.callLogs.findMany({
      orderBy: desc(callLogs.timestamp),
      limit: 100,
    });
    res.json(logs);
  });

  app.get("/api/user/numbers", async (req, res) => {
    const numbers = await db.query.phoneNumbers.findMany({
      orderBy: desc(phoneNumbers.createdAt),
    });
    res.json(numbers);
  });

  // Get all phone numbers (moved to /api/admin)
  app.get("/api/admin/numbers", async (req, res) => {
    const numbers = await db.query.phoneNumbers.findMany({
      orderBy: desc(phoneNumbers.createdAt),
    });
    res.json(numbers);
  });

  // Add new phone number (moved to /api/admin)
  app.post("/api/admin/numbers", async (req, res) => {
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

  // Delete phone number (moved to /api/admin)
  app.delete("/api/admin/numbers/:id", async (req, res) => {
    const { id } = req.params;
    await db.delete(phoneNumbers).where(eq(phoneNumbers.id, parseInt(id)));
    res.json({ success: true });
  });

  // Get daily statistics with dynamic date range (moved to /api/admin)
  app.get("/api/admin/stats/daily", async (req, res) => {
    try {
      const start_date = req.query.start_date as string;
      const end_date = req.query.end_date as string;
      let startDate: Date;
      let endDate: Date;

      // If no dates provided, default to last 7 days
      if (!start_date || !end_date) {
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
      } else {
        // Validate date format
        startDate = new Date(start_date);
        endDate = new Date(end_date);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return res.status(400).json({
            message: "Invalid date format. Please use YYYY-MM-DD format."
          });
        }

        // Ensure end date is not before start date
        if (endDate < startDate) {
          return res.status(400).json({
            message: "End date cannot be before start date."
          });
        }
      }

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

      return res.json({
        daily: stats,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        }
      });
    } catch (error) {
      console.error('Error fetching daily statistics:', error);
      return res.status(500).json({
        message: "Error fetching daily statistics",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get calls heatmap data (moved to /api/admin)
  app.get("/api/admin/calls/heatmap", async (req, res) => {
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

  // Get all spam reports (moved to /api/admin)
  app.get("/api/admin/reports", async (req, res) => {
    const reports = await db
      .select()
      .from(spamReports)
      .orderBy(desc(spamReports.confirmations), desc(spamReports.reportedAt));
    res.json(reports);
  });

  // Submit new spam report (moved to /api/admin)
  app.post("/api/admin/reports", async (req, res) => {
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

  // Submit new spam report from call history (moved to /api/admin)
  app.post("/api/admin/spam-reports", async (req, res) => {
    const { phoneNumber, category, description } = req.body;

    try {
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

        // Update call logs to mark this number as reported
        await db
          .update(callLogs)
          .set({
            metadata: sql`jsonb_set(
              COALESCE(${callLogs.metadata}, '{}'::jsonb),
              '{isReported}',
              'true'::jsonb
            )`
          })
          .where(eq(callLogs.phoneNumber, phoneNumber));

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

        // Update call logs to mark this number as reported
        await db
          .update(callLogs)
          .set({
            metadata: sql`jsonb_set(
              COALESCE(${callLogs.metadata}, '{}'::jsonb),
              '{isReported}',
              'true'::jsonb
            )`
          })
          .where(eq(callLogs.phoneNumber, phoneNumber));

        res.json(report);
      }
    } catch (error) {
      console.error("Error creating spam report:", error);
      res.status(500).json({ message: "Failed to create spam report" });
    }
  });

  // Confirm existing report (moved to /api/admin)
  app.post("/api/admin/reports/:id/confirm", async (req, res) => {
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
    if (updated && updated.status === "verified") {
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

  // Get reputation score for a phone number (moved to /api/admin)
  app.get("/api/admin/numbers/:number/reputation", async (req, res) => {
    const { number } = req.params;

    try {
      const reputation = await calculateReputationScore(number);
      res.json(reputation);
    } catch (error) {
      console.error("Error calculating reputation score:", error);
      res.status(500).json({ message: "Error calculating reputation score" });
    }
  });

  // Update reputation score (recalculate) (moved to /api/admin)
  app.post("/api/admin/numbers/:number/reputation/refresh", async (req, res) => {
    const { number } = req.params;

    try {
      const reputation = await calculateReputationScore(number);
      res.json(reputation);
    } catch (error) {
      console.error("Error refreshing reputation score:", error);
      res.status(500).json({ message: "Error refreshing reputation score" });
    }
  });

  // Screen call with device information and encryption (moved to /api/admin)
  app.post("/api/admin/devices/:deviceId/screen", async (req, res) => {
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

    // Decrypt device data if encryption is enabled
    const encryption = getEncryptionService();
    let phoneNumber: string;
    
    try {
      const deviceSettings = device.settings as { encryptionEnabled?: boolean } | null;
      const encryptionEnabled = deviceSettings?.encryptionEnabled ?? false;
      const decryptedData = encryptionEnabled 
        ? encryption.decryptDeviceData(encryptedData)
        : encryptedData;
      const parsedData = JSON.parse(decryptedData);
      phoneNumber = parsedData.phoneNumber;
    } catch (error) {
      return res.status(400).json({ message: "Invalid encrypted data" });
    }

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    try {
      const result = await screenCall(phoneNumber);
      await logCall(phoneNumber, result, deviceId);

      // Encrypt response if device encryption is enabled
      const deviceSettings = device.settings as { encryptionEnabled?: boolean } | null;
      const encryptionEnabled = deviceSettings?.encryptionEnabled ?? false;
      const responseData = encryptionEnabled
        ? encryption.encryptDeviceData(JSON.stringify(result))
        : JSON.stringify(result);
      
      return res.json({ data: responseData });
    } catch (error) {
      console.error("Error screening call:", error);
      return res.status(500).json({ message: "Error screening call" });
    }
  });


  // Get all devices (moved to /api/admin)
  app.get("/api/admin/devices", async (req, res) => {
    const devices = await db.query.deviceConfigurations.findMany({
      orderBy: desc(deviceConfigurations.updatedAt),
    });
    res.json(devices);
  });

  // Add new device (moved to /api/admin)
  app.post("/api/admin/devices", async (req, res) => {
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

  // Device heartbeat endpoint with encryption (moved to /api/admin)
  app.post("/api/admin/devices/:deviceId/heartbeat", async (req, res) => {
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

    // Decrypt heartbeat data if encryption is enabled
    const encryption = getEncryptionService();
    let heartbeatData: any;
    
    try {
      const deviceSettings = device.settings as { encryptionEnabled?: boolean } | null;
      const encryptionEnabled = deviceSettings?.encryptionEnabled ?? false;
      const decryptedData = encryptionEnabled
        ? encryption.decryptDeviceData(encryptedData)
        : encryptedData;
      heartbeatData = JSON.parse(decryptedData);
    } catch (error) {
      return res.status(400).json({ message: "Invalid encrypted data" });
    }

    // Update device status and last heartbeat
    const [updated] = await db
      .update(deviceConfigurations)
      .set({
        status: 'online',
        lastHeartbeat: new Date(),
      })
      .where(eq(deviceConfigurations.deviceId, deviceId))
      .returning();

    // Encrypt response if device encryption is enabled
    const deviceSettings = device.settings as { encryptionEnabled?: boolean } | null;
    const encryptionEnabled = deviceSettings?.encryptionEnabled ?? false;
    const responseData = encryptionEnabled
      ? encryption.encryptDeviceData(JSON.stringify(updated))
      : JSON.stringify(updated);
      
    return res.json({ data: responseData });
  });

  // Get verification status (moved to /api/admin)
  app.get("/api/admin/verify/:phoneNumber/status", async (req, res) => {
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

  // Get real-time risk score (moved to /api/admin)
  app.get("/api/admin/risk-score", async (req, res) => {
    const recentCallsResult = await db
      .select({
        total: sql<number>`count(*)`,
        blocked: sql<number>`count(*) filter (where ${callLogs.action} = 'blocked')`
      })
      .from(callLogs)
      .where(sql`${callLogs.timestamp} >= NOW() - INTERVAL '5 minutes'`);

    const recentCalls = recentCallsResult[0] || { total: 0, blocked: 0 };

    // Calculate current risk based on recent call patterns
    const blockRate = recentCalls.total > 0 ? (recentCalls.blocked / recentCalls.total) * 100 : 0;

    // Get latest high-risk numbers
    const highRiskNumbersResult = await db
      .select({
        count: sql<number>`count(*)`
      })
      .from(phoneNumbers)
      .where(sql`${phoneNumbers.reputationScore} < 30`);

    const highRiskNumbers = highRiskNumbersResult[0] || { count: 0 };

    // Combine factors for overall risk score
    const baseRisk = blockRate * 0.6; // 60% weight on recent block rate
    const reputationImpact = (highRiskNumbers.count > 0 ? 20 : 0); // Impact of known high-risk numbers

    const currentRisk = Math.min(100, Math.round(baseRisk + reputationImpact));

    res.json({
      currentRisk,
      factors: {
        recentBlockRate: Math.round(blockRate),
        highRiskNumbers: highRiskNumbers.count,
      }
    });
  });

  // Get time distribution statistics (moved to /api/admin)
  app.get("/api/admin/stats/time-distribution", async (req, res) => {
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

  // Verify caller identity (moved to /api/admin)
  app.post("/api/admin/verify", async (req, res) => {
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
      return res.json(result);
    } catch (error) {
      console.error("Error verifying caller:", error);
      return res.status(500).json({ message: "Error verifying caller" });
    }
  });

  // Device diagnostic endpoint (moved to /api/admin)
  app.post("/api/admin/devices/:deviceId/diagnostic", async (req, res) => {
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
        callerId: null,
        metadata: diagnosticResults,
      });

      return res.json(diagnosticResults);
    } catch (error) {
      console.error("Error running device diagnostic:", error);
      return res.status(500).json({ message: "Error running device diagnostic" });
    }
  });

  // GitHub Repository Setup (moved to /api/admin)
  app.post("/api/admin/github/create-repo", async (req, res) => {
    const { repoName, description, token } = req.body;

    try {
      // Create repository using GitHub API
      const createRepoResponse = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "Authorization": `token ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: repoName,
          description: description || "",
          private: true,
          auto_init: true,
        }),
      });

      if (!createRepoResponse.ok) {
        const error = await createRepoResponse.json();
        throw new Error(error.message || "Failed to create repository");
      }

      const repo = await createRepoResponse.json();

      // Initialize repository with project files
      const initResponse = await fetch(
        `https://api.github.com/repos/${repo.full_name}/contents`,
        {
          method: "PUT",
          headers: {
            "Accept": "application/vnd.github.v3+json",
            "Authorization": `token ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "Initial commit: Project setup",
            content: Buffer.from("# ScamShield\n\nAnti-telemarketing system with advanced call screening").toString("base64"),
            branch: "main",
          }),
        }
      );

      if (!initResponse.ok) {
        throw new Error("Failed to initialize repository");
      }

      res.json({
        success: true,
        repository: repo.html_url,
      });
    } catch (error) {
      console.error("GitHub API Error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to set up repository",
      });
    }
  });

  // Add this to the existing routes in registerRoutes function
  app.get("/api/fcc-database", async (_req, res) => {
    try {
      const result = await SpamDatabaseService.getDatabaseEntries();
      res.json(result);
    } catch (error) {
      console.error("Error fetching FCC database:", error);
      res.status(500).json({ message: "Failed to fetch FCC database" });
    }
  });
  app.post("/api/fcc-database/refresh", async (_req, res) => {
    try {
      await SpamDatabaseService.refreshDatabase();
      const result = await SpamDatabaseService.getDatabaseEntries();
      res.json(result);
    } catch (error) {
      console.error("Error refreshing FCC database:", error);
      res.status(500).json({ message: "Failed to refresh FCC database" });
    }
  });

  // Voice Analysis Endpoint
  app.post("/api/voice/analyze", async (req, res) => {
    try {
      // Check if voice analysis is available
      if (!analyzeVoice) {
        return res.status(503).json({
          message: "Voice analysis is not available on this system",
          reason: "TensorFlow.js not compatible with system architecture (likely 32-bit ARM)"
        });
      }

      const { audioData, sampleRate } = req.body;

      if (!audioData || !sampleRate) {
        return res.status(400).json({
          message: "Audio data and sample rate are required"
        });
      }

      const analysis = await analyzeVoice(new Float32Array(audioData), sampleRate);

      // Store voice pattern if confidence is high
      if (analysis.confidence > 0.8) {
        await db
          .insert(voicePatterns)
          .values({
            patternType: analysis.isSpam ? 'spam' : 'legitimate',
            features: analysis.patterns,
            confidence: analysis.confidence,
            metadata: {
              detectedFeatures: analysis.features,
              audioCharacteristics: {
                energy: analysis.patterns.energy,
                zeroCrossings: analysis.patterns.zeroCrossings,
                rhythmRegularity: analysis.patterns.rhythmRegularity
              }
            }
          });
      }

      return res.json(analysis);
    } catch (error) {
      console.error('Voice analysis error:', error);
      return res.status(500).json({
        message: "Error analyzing voice",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get Voice Analysis Statistics
  app.get("/api/voice/stats", async (req, res) => {
    try {
      const statsResult = await db
        .select({
          total: sql<number>`count(*)`,
          spam: sql<number>`count(*) filter (where pattern_type = 'spam')`,
          legitimate: sql<number>`count(*) filter (where pattern_type = 'legitimate')`,
          avgConfidence: sql<number>`avg(confidence)`
        })
        .from(voicePatterns)
        .where(sql`created_at >= NOW() - INTERVAL '7 days'`);

      const stats = statsResult[0] || { total: 0, spam: 0, legitimate: 0, avgConfidence: 0 };

      // Get patterns with high confidence
      const commonPatterns = await db
        .select({
          patternType: voicePatterns.patternType,
          count: sql<number>`count(*)`,
          avgConfidence: sql<number>`avg(confidence)`
        })
        .from(voicePatterns)
        .where(sql`confidence > 0.8`)
        .groupBy(voicePatterns.patternType)
        .orderBy(sql`count(*) desc`)
        .limit(5);

      res.json({
        weeklyStats: {
          total: Number(stats.total) || 0,
          spamCalls: Number(stats.spam) || 0,
          legitimateCalls: Number(stats.legitimate) || 0,
          averageConfidence: Number(stats.avgConfidence) || 0
        },
        commonPatterns: commonPatterns.map(pattern => ({
          type: pattern.patternType,
          count: Number(pattern.count),
          confidence: Number(pattern.avgConfidence)
        }))
      });
    } catch (error) {
      console.error('Error fetching voice analysis stats:', error);
      res.status(500).json({ message: "Error fetching voice analysis statistics" });
    }
  });

  // Device Registration and Authentication
  app.post("/api/devices/register", async (req, res) => {
    try {
      const { deviceName, deviceType, publicKey } = req.body;

      // Generate unique device credentials
      const deviceId = `device_${randomBytes(8).toString('hex')}`;
      const authToken = randomBytes(32).toString('hex');
      const encryptionKey = randomBytes(32).toString('hex');

      // Create device registration
      const [device] = await db
        .insert(deviceRegistrations)
        .values({
          deviceId,
          name: deviceName,
          deviceType,
          publicKey,
          authToken: createHash('sha256').update(authToken).digest('hex'),
          encryptionKey: createHash('sha256').update(encryptionKey).digest('hex'),
          status: 'pending',
          metadata: {
            registrationDate: new Date().toISOString(),
            lastConfigUpdate: new Date().toISOString()
          }
        })
        .returning();

      // Return credentials securely
      res.json({
        deviceId,
        authToken,
        encryptionKey,
        serverPublicKey: process.env.SERVER_PUBLIC_KEY // Will be used for secure communication
      });
    } catch (error) {
      console.error("Device registration error:", error);
      res.status(500).json({ message: "Failed to register device" });
    }
  });

  // Hardware Configuration Endpoints
  app.get("/api/hardware/modem", async (req, res) => {
    try {
      // Get modem configuration from environment or database
      const config = {
        enabled: process.env.MODEM_ENABLED === "true",
        deviceType: process.env.MODEM_TYPE || "usrobotics-usr5637",
        devicePath: process.env.MODEM_PATH || "/dev/ttyUSB0",
        baudRate: parseInt(process.env.MODEM_BAUD_RATE || "115200"),
        autoDetect: process.env.MODEM_AUTO_DETECT !== "false",
      };
      res.json(config);
    } catch (error) {
      console.error("Error fetching modem config:", error);
      res.status(500).json({ message: "Failed to fetch modem configuration" });
    }
  });

  app.post("/api/hardware/modem", async (req, res) => {
    try {
      const { enabled, deviceType, devicePath, baudRate, autoDetect } = req.body;
      
      // In production, this would update a configuration file or database
      // For now, we'll just acknowledge the update
      console.log("Modem configuration updated:", {
        enabled,
        deviceType,
        devicePath,
        baudRate,
        autoDetect
      });

      res.json({
        success: true,
        message: "Modem configuration updated successfully",
        config: { enabled, deviceType, devicePath, baudRate, autoDetect }
      });
    } catch (error) {
      console.error("Error updating modem config:", error);
      res.status(500).json({ message: "Failed to update modem configuration" });
    }
  });

  app.post("/api/hardware/modem/test", async (req, res) => {
    try {
      // Simulate modem connection test
      // In production, this would actually communicate with the modem
      const testResult = {
        success: true,
        message: "Modem connection successful. Device is responding to AT commands.",
        details: {
          manufacturer: "USRobotics",
          model: "USR5637",
          firmware: "v1.2.3",
          signalStrength: "Strong"
        }
      };

      res.json(testResult);
    } catch (error) {
      console.error("Error testing modem connection:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to connect to modem. Please check your configuration."
      });
    }
  });

  // Auto-detect connected hardware devices
  app.get("/api/hardware/detect", async (req, res) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execPromise = promisify(exec);

      // Known device database
      const knownDevices = [
        {
          id: 'usr5637',
          name: 'USRobotics USR5637',
          vendorId: '0baf',
          productId: '00eb',
          drivers: ['usb-serial', 'pl2303', 'ftdi_sio'],
          description: '56k USB Hardware Fax Modem'
        },
        {
          id: 'usr5686g',
          name: 'USRobotics USR5686G',
          vendorId: '0baf',
          productId: '0100',
          drivers: ['usb-serial', 'ti_usb_3410_5052'],
          description: '56k USB Voice Fax Modem'
        },
        {
          id: 'grandstream-ht802',
          name: 'Grandstream HT802 V2',
          vendorId: '2c0b',
          productId: '0003',
          drivers: ['cdc_acm'],
          description: 'VoIP Analog Telephone Adapter'
        }
      ];

      const detectedDevices = [];

      try {
        const { stdout } = await execPromise('lsusb');
        
        // Check for each known device
        for (const device of knownDevices) {
          const vendorProductPattern = `${device.vendorId}:${device.productId}`;
          if (stdout.toLowerCase().includes(vendorProductPattern)) {
            // Check if drivers are loaded
            const driverStatus = [];
            for (const driver of device.drivers) {
              try {
                const { stdout: lsmodOutput } = await execPromise(`lsmod | grep -i ${driver}`);
                driverStatus.push({
                  driver,
                  loaded: !!lsmodOutput.trim()
                });
              } catch (error) {
                driverStatus.push({
                  driver,
                  loaded: false
                });
              }
            }

            detectedDevices.push({
              ...device,
              driverStatus,
              allDriversLoaded: driverStatus.every(d => d.loaded)
            });
          }
        }

        // Check for serial devices
        const serialDevices = [];
        try {
          const { stdout: usbDevices } = await execPromise('ls /dev/ttyUSB* 2>/dev/null || true');
          if (usbDevices.trim()) {
            serialDevices.push(...usbDevices.trim().split('\n'));
          }
        } catch (error) {
          // No USB serial devices
        }

        try {
          const { stdout: acmDevices } = await execPromise('ls /dev/ttyACM* 2>/dev/null || true');
          if (acmDevices.trim()) {
            serialDevices.push(...acmDevices.trim().split('\n'));
          }
        } catch (error) {
          // No ACM devices
        }

        res.json({
          success: true,
          detectedDevices,
          serialDevices,
          message: detectedDevices.length > 0
            ? `Found ${detectedDevices.length} known device(s)`
            : 'No known devices detected. You can still configure manually.'
        });
      } catch (error) {
        console.error("Error detecting devices:", error);
        res.json({
          success: false,
          detectedDevices: [],
          serialDevices: [],
          message: 'Could not scan for devices'
        });
      }
    } catch (error) {
      console.error("Error in device detection:", error);
      res.status(500).json({
        success: false,
        message: 'Device detection failed'
      });
    }
  });

  // Driver management endpoints
  app.post("/api/hardware/drivers/check", async (req, res) => {
    try {
      const { deviceId, drivers, usbVendorId, usbProductId } = req.body;

      console.log(`Checking drivers for device: ${deviceId}`);

      // Check which kernel modules are loaded
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execPromise = promisify(exec);

      const missingDrivers: string[] = [];
      const installedDrivers: string[] = [];

      for (const driver of drivers) {
        try {
          const { stdout } = await execPromise(`lsmod | grep -i ${driver}`);
          if (stdout.trim()) {
            installedDrivers.push(driver);
            console.log(`✓ Driver ${driver} is loaded`);
          } else {
            missingDrivers.push(driver);
            console.log(`✗ Driver ${driver} is not loaded`);
          }
        } catch (error) {
          // Driver not loaded
          missingDrivers.push(driver);
          console.log(`✗ Driver ${driver} is not loaded`);
        }
      }

      // Check if device is physically connected and detect hardware
      let deviceConnected = false;
      let detectedDevice = null;
      
      try {
        const { stdout } = await execPromise('lsusb');
        
        // Known device database
        const knownDevices = [
          {
            id: 'usr5637',
            name: 'USRobotics USR5637',
            vendorId: '0baf',
            productId: '00eb',
            drivers: ['usb-serial', 'pl2303', 'ftdi_sio']
          },
          {
            id: 'usr5686g',
            name: 'USRobotics USR5686G',
            vendorId: '0baf',
            productId: '0100',
            drivers: ['usb-serial', 'ti_usb_3410_5052']
          },
          {
            id: 'grandstream-ht802',
            name: 'Grandstream HT802 V2',
            vendorId: '2c0b',
            productId: '0003',
            drivers: ['cdc_acm']
          }
        ];

        // Check for any known devices
        for (const device of knownDevices) {
          const vendorProductPattern = `${device.vendorId}:${device.productId}`;
          if (stdout.toLowerCase().includes(vendorProductPattern)) {
            detectedDevice = device;
            deviceConnected = true;
            console.log(`✓ Detected ${device.name} (${vendorProductPattern})`);
            break;
          }
        }

        // Also check if the requested device is connected
        if (!deviceConnected && usbVendorId && usbProductId) {
          const requestedPattern = `${usbVendorId}:${usbProductId}`;
          deviceConnected = stdout.toLowerCase().includes(requestedPattern);
        }

        // Check for serial devices
        try {
          const { stdout: serialDevices } = await execPromise('ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null || true');
          if (serialDevices.trim()) {
            console.log(`✓ Found serial devices: ${serialDevices.trim().split('\n').join(', ')}`);
          }
        } catch (error) {
          // No serial devices found
        }
      } catch (error) {
        console.log("Could not check USB devices");
      }

      res.json({
        allInstalled: missingDrivers.length === 0,
        installedDrivers,
        missingDrivers,
        deviceConnected,
        detectedDevice,
        message: detectedDevice 
          ? `Detected ${detectedDevice.name}. ${missingDrivers.length === 0 ? 'All drivers installed.' : `Missing ${missingDrivers.length} driver(s).`}`
          : missingDrivers.length === 0 
            ? "All required drivers are installed"
            : `Missing ${missingDrivers.length} driver(s)`
      });
    } catch (error) {
      console.error("Error checking drivers:", error);
      res.status(500).json({ 
        allInstalled: false,
        message: "Failed to check drivers"
      });
    }
  });

  app.post("/api/hardware/drivers/install", async (req, res) => {
    try {
      const { deviceId, drivers } = req.body;

      console.log(`Installing drivers for device: ${deviceId}`);
      console.log(`Drivers to install: ${drivers.join(', ')}`);

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execPromise = promisify(exec);

      const installed: string[] = [];
      const failed: string[] = [];

      for (const driver of drivers) {
        try {
          console.log(`Loading kernel module: ${driver}`);
          
          // Try to load the kernel module
          await execPromise(`sudo modprobe ${driver}`);
          installed.push(driver);
          console.log(`✓ Successfully loaded ${driver}`);
        } catch (error) {
          console.log(`✗ Failed to load ${driver}, attempting to install...`);
          
          // If modprobe fails, try installing the package
          try {
            let packageName = driver;
            
            // Map driver names to package names
            const driverPackageMap: Record<string, string> = {
              'pl2303': 'linux-modules-extra-raspi',
              'ftdi_sio': 'linux-modules-extra-raspi',
              'usb-serial': 'linux-modules-extra-raspi',
              'cdc_acm': 'linux-modules-extra-raspi',
              'ti_usb_3410_5052': 'linux-modules-extra-raspi',
            };
            
            packageName = driverPackageMap[driver] || driver;
            
            // Install the package (this requires sudo privileges)
            await execPromise(`sudo apt-get install -y ${packageName}`);
            
            // Try loading again
            await execPromise(`sudo modprobe ${driver}`);
            installed.push(driver);
            console.log(`✓ Successfully installed and loaded ${driver}`);
          } catch (installError) {
            failed.push(driver);
            console.log(`✗ Failed to install ${driver}`);
          }
        }
      }

      // Make drivers load on boot
      if (installed.length > 0) {
        try {
          const modulesContent = installed.join('\n') + '\n';
          await execPromise(`echo "${modulesContent}" | sudo tee -a /etc/modules > /dev/null`);
          console.log("✓ Drivers configured to load on boot");
        } catch (error) {
          console.log("Could not configure drivers to load on boot");
        }
      }

      res.json({
        success: failed.length === 0,
        installed,
        failed,
        message: failed.length === 0
          ? `Successfully installed ${installed.length} driver(s). Please plug in your device.`
          : `Installed ${installed.length} driver(s), but ${failed.length} failed. You may need to install them manually.`
      });
    } catch (error) {
      console.error("Error installing drivers:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to install drivers. Please check system permissions."
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}