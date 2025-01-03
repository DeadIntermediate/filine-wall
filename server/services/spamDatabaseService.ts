import fetch from "node-fetch";
import { db } from "@db";
import { phoneNumbers } from "@db/schema";
import { eq } from "drizzle-orm";

interface FCCSpamRecord {
  phoneNumber: string;
  reportCount: number;
  lastReported: string;
  category: string;
}

export class SpamDatabaseService {
  private static BASE_URL = "https://opendata.fcc.gov/resource/unwanted-calls.json";
  private static CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static lastUpdate: Date | null = null;
  private static cache: Map<string, FCCSpamRecord> = new Map();

  static async refreshDatabase() {
    try {
      const response = await fetch(this.BASE_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch FCC data: ${response.statusText}`);
      }

      const data = await response.json() as FCCSpamRecord[];
      this.cache.clear();

      // Update cache
      data.forEach(record => {
        this.cache.set(record.phoneNumber, record);
      });

      this.lastUpdate = new Date();

      // Update our database with new spam numbers
      await Promise.all(data.map(async record => {
        if (record.reportCount > 10) { // Only add frequently reported numbers
          try {
            await db.insert(phoneNumbers)
              .values({
                number: record.phoneNumber,
                type: "blacklist",
                description: `Auto-blocked: FCC Database (${record.category})`,
                scoreFactors: { fccReports: record.reportCount },
              })
              .onConflictDoUpdate({
                target: phoneNumbers.number,
                set: {
                  scoreFactors: { fccReports: record.reportCount },
                },
              });
          } catch (error) {
            console.error(`Failed to update database for number ${record.phoneNumber}:`, error);
          }
        }
      }));

      console.log(`Successfully refreshed FCC database with ${data.length} records`);
    } catch (error) {
      console.error("Error refreshing FCC spam database:", error);
      // Don't throw the error, just log it to prevent app crash
    }
  }

  static async checkNumber(phoneNumber: string): Promise<{ 
    isSpam: boolean;
    details?: FCCSpamRecord;
  }> {
    // Refresh cache if needed
    if (!this.lastUpdate || Date.now() - this.lastUpdate.getTime() > this.CACHE_DURATION) {
      await this.refreshDatabase().catch(console.error);
    }

    const record = this.cache.get(phoneNumber);
    return {
      isSpam: !!record,
      details: record,
    };
  }
}