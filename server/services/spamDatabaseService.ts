import { db } from "@db";
import { phoneNumbers } from "@db/schema";
import { eq } from "drizzle-orm";
import twilio from "twilio";

/**
 * Service for managing spam number database using Twilio Lookup API.
 */

interface SpamRecord {
  phoneNumber: string;
  reportCount: number;
  lastReported: string;
  category: string;
  carrier?: string;
  type?: string;
}

export class SpamDatabaseService {
  private static lastUpdate: Date | null = null;
  private static cache: Map<string, SpamRecord> = new Map();
  private static twilioClient: twilio.Twilio | null = null;

  private static initTwilioClient(): twilio.Twilio | null {
    if (this.twilioClient) return this.twilioClient;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.warn("Twilio credentials not configured - spam detection will use local database only");
      return null;
    }

    try {
      this.twilioClient = twilio(accountSid, authToken);
      return this.twilioClient;
    } catch (error) {
      console.error("Failed to initialize Twilio client:", error);
      return null;
    }
  }

  static async refreshDatabase() {
    try {
      console.log("Starting spam database refresh...");

      // Clear existing cache
      this.cache.clear();

      // Get all numbers from our database
      const allNumbers = await db.query.phoneNumbers.findMany();

      // Initialize Twilio client - continue even if it fails
      const client = this.initTwilioClient();

      // Process each number
      const lookupPromises = allNumbers.map(async (entry) => {
        try {
          // If Twilio is available, get additional data
          if (client) {
            const lookupResult = await client.lookups.v2
              .phoneNumbers(entry.number)
              .fetch();

            // Safe access to Twilio response properties
            const spamScore = (lookupResult as any).spamScore || 0;
            const carrier = (lookupResult as any).carrier?.name || 'Unknown';
            const lineType = (lookupResult as any).lineType || 'Unknown';

            const record: SpamRecord = {
              phoneNumber: entry.number,
              reportCount: Math.floor(spamScore * 100),
              lastReported: new Date().toISOString(),
              category: spamScore > 0.7 ? "high_risk" : spamScore > 0.3 ? "medium_risk" : "low_risk",
              carrier,
              type: lineType,
            };

            this.cache.set(entry.number, record);

            // Update database entry with latest info
            await db
              .update(phoneNumbers)
              .set({
                scoreFactors: {
                  twilioSpamScore: spamScore,
                  carrier,
                  lineType,
                  lastChecked: new Date().toISOString(),
                },
                reputationScore: String(100 - (spamScore * 100)), // Convert to string for compatibility
              })
              .where(eq(phoneNumbers.number, entry.number));
          } else {
            // Fallback to basic record without Twilio data
            const record: SpamRecord = {
              phoneNumber: entry.number,
              reportCount: entry.reputationScore ? 100 - parseInt(entry.reputationScore) : 0,
              lastReported: new Date().toISOString(),
              category: entry.type === 'blacklist' ? 'high_risk' : 'low_risk',
              carrier: 'Unknown',
              type: 'Unknown'
            };

            this.cache.set(entry.number, record);
          }
        } catch (error) {
          console.error(`Failed to process number ${entry.number}:`, error);
          // Add basic record even if lookup fails
          this.cache.set(entry.number, {
            phoneNumber: entry.number,
            reportCount: 0,
            lastReported: new Date().toISOString(),
            category: 'unknown',
            carrier: 'Unknown',
            type: 'Unknown'
          });
        }
      });

      await Promise.all(lookupPromises);

      this.lastUpdate = new Date();

      console.log(`Successfully refreshed spam database with ${this.cache.size} records`);

      return {
        success: true,
        timestamp: this.lastUpdate,
        recordCount: this.cache.size,
        twilioEnabled: !!this.twilioClient
      };
    } catch (error) {
      console.error("Error refreshing spam database:", error);
      throw error;
    }
  }

  static async checkNumber(phoneNumber: string): Promise<{ 
    isSpam: boolean;
    details?: SpamRecord;
  }> {
    try {
      const client = this.initTwilioClient();

      if (client) {
        // If Twilio is available, use it for checking
        const lookupResult = await client.lookups.v2
          .phoneNumbers(phoneNumber)
          .fetch();

        const spamScore = (lookupResult as any).spamScore || 0;
        const record: SpamRecord = {
          phoneNumber,
          reportCount: Math.floor(spamScore * 100),
          lastReported: new Date().toISOString(),
          category: spamScore > 0.7 ? "high_risk" : spamScore > 0.3 ? "medium_risk" : "low_risk",
          carrier: (lookupResult as any).carrier?.name || 'Unknown',
          type: (lookupResult as any).lineType || 'Unknown',
        };

        return {
          isSpam: spamScore > 0.5,
          details: record
        };
      } else {
        // Fallback to database check
        const number = await db.query.phoneNumbers.findFirst({
          where: eq(phoneNumbers.number, phoneNumber),
        });

        if (!number) {
          return { isSpam: false };
        }

        const record: SpamRecord = {
          phoneNumber,
          reportCount: number.reputationScore ? 100 - parseInt(number.reputationScore) : 0,
          lastReported: new Date().toISOString(),
          category: number.type === 'blacklist' ? 'high_risk' : 'low_risk',
          carrier: 'Unknown',
          type: 'Unknown'
        };

        return {
          isSpam: number.type === 'blacklist',
          details: record
        };
      }
    } catch (error) {
      console.error("Error checking number:", error);
      throw error;
    }
  }

  static async getDatabaseEntries(): Promise<{
    records: SpamRecord[];
    lastUpdate: Date | null;
  }> {
    return {
      records: Array.from(this.cache.values()),
      lastUpdate: this.lastUpdate
    };
  }
}