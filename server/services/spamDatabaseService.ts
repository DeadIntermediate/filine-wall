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
  private static twilioClient: twilio.Twilio;

  private static initTwilioClient() {
    if (!this.twilioClient) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        throw new Error("Twilio credentials not configured");
      }

      this.twilioClient = twilio(accountSid, authToken);
    }
    return this.twilioClient;
  }

  static async refreshDatabase() {
    try {
      console.log("Starting Twilio spam database refresh...");

      // Clear existing cache
      this.cache.clear();

      // Get all numbers from our database
      const allNumbers = await db.query.phoneNumbers.findMany();

      // Initialize Twilio client
      const client = this.initTwilioClient();

      // Check each number with Twilio Lookup
      const lookupPromises = allNumbers.map(async (entry) => {
        try {
          const lookupResult = await client.lookups.v2
            .phoneNumbers(entry.number)
            .fetch({ fields: "spam_score,line_type_intelligence" });

          if (lookupResult.validNumber) {
            const spamScore = lookupResult.spamScore || 0;
            const record: SpamRecord = {
              phoneNumber: entry.number,
              reportCount: Math.floor(spamScore * 100), // Convert spam score to a count
              lastReported: new Date().toISOString(),
              category: spamScore > 0.7 ? "high_risk" : spamScore > 0.3 ? "medium_risk" : "low_risk",
              carrier: lookupResult.carrier?.name,
              type: lookupResult.lineType,
            };

            this.cache.set(entry.number, record);

            // Update database entry with latest info
            await db
              .update(phoneNumbers)
              .set({
                scoreFactors: {
                  twilioSpamScore: spamScore,
                  carrier: lookupResult.carrier?.name,
                  lineType: lookupResult.lineType,
                  lastChecked: new Date().toISOString(),
                },
                reputationScore: 100 - (spamScore * 100), // Convert spam score to reputation
              })
              .where(eq(phoneNumbers.number, entry.number));
          }
        } catch (error) {
          console.error(`Failed to lookup number ${entry.number}:`, error);
        }
      });

      await Promise.all(lookupPromises);

      this.lastUpdate = new Date();

      console.log(`Successfully refreshed spam database with ${this.cache.size} records`);

      return {
        success: true,
        timestamp: this.lastUpdate,
        recordCount: this.cache.size
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
      const lookupResult = await client.lookups.v2
        .phoneNumbers(phoneNumber)
        .fetch({ fields: "spam_score,line_type_intelligence" });

      if (!lookupResult.validNumber) {
        return { isSpam: true }; // Invalid numbers are considered suspicious
      }

      const spamScore = lookupResult.spamScore || 0;
      const record: SpamRecord = {
        phoneNumber,
        reportCount: Math.floor(spamScore * 100),
        lastReported: new Date().toISOString(),
        category: spamScore > 0.7 ? "high_risk" : spamScore > 0.3 ? "medium_risk" : "low_risk",
        carrier: lookupResult.carrier?.name,
        type: lookupResult.lineType,
      };

      return {
        isSpam: spamScore > 0.5,
        details: record
      };
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