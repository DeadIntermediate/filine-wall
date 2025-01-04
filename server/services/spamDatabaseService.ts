import { db } from "@db";
import { phoneNumbers } from "@db/schema";
import { eq } from "drizzle-orm";

/**
 * Service for managing spam number database.
 * Currently uses mock data for development.
 * 
 * NOTE: This is currently using MOCK DATA for development.
 * In production, this would integrate with external APIs like:
 * - FCC's Complaint Database API
 * - Truecaller API
 * - Robokiller API
 * - Hiya Fraud/Spam API
 * - YouMail API
 * - Twilio Lookup API
 */

interface FCCSpamRecord {
  phoneNumber: string;
  reportCount: number;
  lastReported: string;
  category: string;
}

export class SpamDatabaseService {
  private static lastUpdate: Date | null = null;
  private static cache: Map<string, FCCSpamRecord> = new Map();
  private static readonly MOCK_MODE = true; // Explicitly indicate we're in mock mode

  // Sample data for development
  private static readonly MOCK_DATA: FCCSpamRecord[] = [
    {
      phoneNumber: "1-800-555-0123",
      reportCount: 127,
      lastReported: new Date().toISOString(),
      category: "telemarketing"
    },
    {
      phoneNumber: "1-888-555-0456",
      reportCount: 89,
      lastReported: new Date().toISOString(),
      category: "robocall"
    },
    {
      phoneNumber: "1-877-555-0789",
      reportCount: 234,
      lastReported: new Date().toISOString(),
      category: "scam"
    },
    {
      phoneNumber: "1-866-555-0147",
      reportCount: 56,
      lastReported: new Date().toISOString(),
      category: "impersonator"
    },
    {
      phoneNumber: "1-855-555-0258",
      reportCount: 167,
      lastReported: new Date().toISOString(),
      category: "debt_collection"
    }
  ];

  static async refreshDatabase() {
    try {
      console.log("Starting database refresh...");
      console.log(`Mode: ${this.MOCK_MODE ? 'MOCK DATA' : 'PRODUCTION'}`);

      // In production, this would fetch from the FCC API
      // For now, use mock data
      const data = this.MOCK_DATA;

      this.cache.clear();

      // Update cache
      data.forEach(record => {
        this.cache.set(record.phoneNumber, record);
      });

      this.lastUpdate = new Date();

      // Update our database with spam numbers
      await Promise.all(data.map(async record => {
        if (record.reportCount > 5) {
          try {
            await db.insert(phoneNumbers)
              .values({
                number: record.phoneNumber,
                type: "blacklist",
                description: `[MOCK DATA] Auto-blocked: Test Database (${record.category})`,
                scoreFactors: { 
                  fccReports: record.reportCount,
                  mockData: true,
                  lastUpdated: new Date().toISOString()
                },
              })
              .onConflictDoUpdate({
                target: phoneNumbers.number,
                set: {
                  scoreFactors: { 
                    fccReports: record.reportCount,
                    mockData: true,
                    lastUpdated: new Date().toISOString()
                  },
                },
              });
          } catch (error) {
            console.error(`Failed to update database for number ${record.phoneNumber}:`, error);
          }
        }
      }));

      console.log(`Successfully refreshed spam database with ${data.length} records`);

      return {
        success: true,
        timestamp: this.lastUpdate,
        mode: this.MOCK_MODE ? 'MOCK' : 'PRODUCTION',
        recordCount: data.length
      };
    } catch (error) {
      console.error("Error refreshing spam database:", error);
      throw error;
    }
  }

  static async checkNumber(phoneNumber: string): Promise<{ 
    isSpam: boolean;
    details?: FCCSpamRecord;
    isMockData: boolean;
  }> {
    const record = this.cache.get(phoneNumber);
    return {
      isSpam: !!record,
      details: record,
      isMockData: this.MOCK_MODE
    };
  }

  static async getDatabaseEntries(): Promise<{
    records: FCCSpamRecord[];
    lastUpdate: Date | null;
    isMockData: boolean;
  }> {
    return {
      records: Array.from(this.cache.values()),
      lastUpdate: this.lastUpdate,
      isMockData: this.MOCK_MODE
    };
  }
}