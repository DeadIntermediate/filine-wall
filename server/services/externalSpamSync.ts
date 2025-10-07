import fetch from "node-fetch";
import { db } from "@db";
import { phoneNumbers } from "@db/schema";

interface ExternalSpamSource {
  name: string;
  enabled: boolean;
  apiKey?: string;
  endpoint?: string;
}

interface SpamNumber {
  number: string;
  source: string;
  confidence: number;
  category?: string;
  lastReported?: Date;
}

export class ExternalSpamSyncService {
  private sources: Map<string, ExternalSpamSource> = new Map();
  private lastSync: Map<string, Date> = new Map();
  private readonly SYNC_INTERVAL = 86400000; // 24 hours

  constructor() {
    // Initialize supported sources
    this.sources.set("hiya", {
      name: "Hiya",
      enabled: !!process.env.HIYA_API_KEY,
      apiKey: process.env.HIYA_API_KEY,
      endpoint: "https://api.hiya.com/v1/lookup"
    });

    this.sources.set("nomorobo", {
      name: "Nomorobo",
      enabled: !!process.env.NOMOROBO_API_KEY,
      apiKey: process.env.NOMOROBO_API_KEY,
      endpoint: "https://api.nomorobo.com/v1/check"
    });

    this.sources.set("truecaller", {
      name: "TrueCaller",
      enabled: !!process.env.TRUECALLER_API_KEY,
      apiKey: process.env.TRUECALLER_API_KEY,
      endpoint: "https://api.truecaller.com/v1/search"
    });

    this.sources.set("tellows", {
      name: "Tellows",
      enabled: !!process.env.TELLOWS_API_KEY,
      apiKey: process.env.TELLOWS_API_KEY,
      endpoint: "https://www.tellows.com/basic/num"
    });
  }

  /**
   * Sync spam lists from all enabled external sources
   */
  async syncAll(): Promise<{ success: number; failed: number; total: number }> {
    console.log("Starting external spam database sync...");
    
    const results = {
      success: 0,
      failed: 0,
      total: 0
    };

    for (const [sourceId, source] of this.sources) {
      if (!source.enabled) {
        console.log(`Skipping ${source.name} - not enabled`);
        continue;
      }

      const lastSyncTime = this.lastSync.get(sourceId);
      if (lastSyncTime && Date.now() - lastSyncTime.getTime() < this.SYNC_INTERVAL) {
        console.log(`Skipping ${source.name} - synced recently`);
        continue;
      }

      try {
        const count = await this.syncSource(sourceId, source);
        results.success++;
        results.total += count;
        this.lastSync.set(sourceId, new Date());
        console.log(`Successfully synced ${count} numbers from ${source.name}`);
      } catch (error) {
        results.failed++;
        console.error(`Failed to sync from ${source.name}:`, error);
      }
    }

    console.log(`Sync complete: ${results.success} sources synced, ${results.total} numbers updated`);
    return results;
  }

  /**
   * Check a specific number against external sources
   */
  async checkNumber(phoneNumber: string): Promise<{
    isSpam: boolean;
    confidence: number;
    sources: string[];
    details?: any;
  }> {
    const checks = [];

    for (const [sourceId, source] of this.sources) {
      if (source.enabled) {
        checks.push(this.checkNumberAgainstSource(phoneNumber, sourceId, source));
      }
    }

    const results = await Promise.allSettled(checks);
    const successfulChecks = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map(r => r.value)
      .filter(Boolean);

    if (successfulChecks.length === 0) {
      return {
        isSpam: false,
        confidence: 0,
        sources: []
      };
    }

    const spamCount = successfulChecks.filter(c => c.isSpam).length;
    const sources = successfulChecks.filter(c => c.isSpam).map(c => c.source);
    const avgConfidence = successfulChecks.reduce((sum, c) => sum + c.confidence, 0) / successfulChecks.length;

    return {
      isSpam: spamCount > 0,
      confidence: avgConfidence,
      sources,
      details: successfulChecks
    };
  }

  /**
   * Sync from a specific external source
   */
  private async syncSource(sourceId: string, source: ExternalSpamSource): Promise<number> {
    switch (sourceId) {
      case "hiya":
        return await this.syncHiya(source);
      case "nomorobo":
        return await this.syncNomorobo(source);
      case "truecaller":
        return await this.syncTrueCaller(source);
      case "tellows":
        return await this.syncTellows(source);
      default:
        return 0;
    }
  }

  private async syncHiya(source: ExternalSpamSource): Promise<number> {
    // Placeholder - would need actual Hiya API integration
    console.log("Hiya sync not yet implemented - API integration required");
    return 0;
  }

  private async syncNomorobo(source: ExternalSpamSource): Promise<number> {
    // Placeholder - would need actual Nomorobo API integration
    console.log("Nomorobo sync not yet implemented - API integration required");
    return 0;
  }

  private async syncTrueCaller(source: ExternalSpamSource): Promise<number> {
    // Placeholder - would need actual TrueCaller API integration
    console.log("TrueCaller sync not yet implemented - API integration required");
    return 0;
  }

  private async syncTellows(source: ExternalSpamSource): Promise<number> {
    // Placeholder - would need actual Tellows API integration
    console.log("Tellows sync not yet implemented - API integration required");
    return 0;
  }

  /**
   * Check number against a specific source
   */
  private async checkNumberAgainstSource(
    phoneNumber: string,
    sourceId: string,
    source: ExternalSpamSource
  ): Promise<{ isSpam: boolean; confidence: number; source: string } | null> {
    if (!source.endpoint || !source.apiKey) {
      return null;
    }

    try {
      // This is a generic implementation - each API would need its own adapter
      const response = await fetch(`${source.endpoint}?number=${encodeURIComponent(phoneNumber)}`, {
        headers: {
          "Authorization": `Bearer ${source.apiKey}`,
          "Content-Type": "application/json"
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as any;
      
      // Generic response parsing - would need customization per API
      return {
        isSpam: data.spam === true || data.isSpam === true || data.spamScore > 0.5,
        confidence: data.confidence || data.spamScore || 0.5,
        source: source.name
      };
    } catch (error) {
      console.error(`Error checking ${phoneNumber} against ${source.name}:`, error);
      return null;
    }
  }

  /**
   * Add a spam number to the local database from external source
   */
  private async addSpamNumber(spamNumber: SpamNumber): Promise<void> {
    try {
      await db
        .insert(phoneNumbers)
        .values({
          number: spamNumber.number,
          type: "blacklist",
          reputationScore: Math.round((1 - spamNumber.confidence) * 100),
          metadata: {
            source: spamNumber.source,
            category: spamNumber.category,
            lastReported: spamNumber.lastReported?.toISOString(),
            externalSync: true,
            confidence: spamNumber.confidence
          }
        })
        .onConflictDoUpdate({
          target: phoneNumbers.number,
          set: {
            type: "blacklist",
            reputationScore: Math.round((1 - spamNumber.confidence) * 100),
            metadata: {
              source: spamNumber.source,
              category: spamNumber.category,
              lastReported: spamNumber.lastReported?.toISOString(),
              externalSync: true,
              confidence: spamNumber.confidence
            }
          }
        });
    } catch (error) {
      console.error("Error adding spam number to database:", error);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    source: string;
    enabled: boolean;
    lastSync: Date | null;
  }[] {
    return Array.from(this.sources.entries()).map(([id, source]) => ({
      source: source.name,
      enabled: source.enabled,
      lastSync: this.lastSync.get(id) || null
    }));
  }
}

// Singleton instance
export const externalSpamSync = new ExternalSpamSyncService();

// Auto-sync on startup and every 24 hours
externalSpamSync.syncAll().catch(console.error);
setInterval(() => {
  externalSpamSync.syncAll().catch(console.error);
}, 86400000);
