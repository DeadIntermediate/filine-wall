import { LRUCache } from 'lru-cache';
import { db } from "@db";
import { phoneNumbers, spamReports } from "@db/schema";
import { eq } from "drizzle-orm";

interface CachedCallResult {
  isSpam: boolean;
  confidence: number;
  lastUpdated: number;
  metadata?: Record<string, any>;
}

export class CallCachingService {
  private static instance: CallCachingService;
  private cache: LRUCache<string, CachedCallResult>;
  private readonly CACHE_TTL = 1000 * 60 * 30; // 30 minutes
  private readonly MAX_CACHE_SIZE = 10000; // Store up to 10k numbers

  private constructor() {
    this.cache = new LRUCache<string, CachedCallResult>({
      max: this.MAX_CACHE_SIZE,
      ttl: this.CACHE_TTL,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });
  }

  public static getInstance(): CallCachingService {
    if (!CallCachingService.instance) {
      CallCachingService.instance = new CallCachingService();
    }
    return CallCachingService.instance;
  }

  async getCallResult(phoneNumber: string): Promise<CachedCallResult | null> {
    // Check cache first
    const cached = this.cache.get(phoneNumber);
    if (cached) {
      return cached;
    }

    // If not in cache, check database
    try {
      const [blacklisted, spamReport] = await Promise.all([
        db.query.phoneNumbers.findFirst({
          where: eq(phoneNumbers.number, phoneNumber),
        }),
        db.query.spamReports.findFirst({
          where: eq(spamReports.phoneNumber, phoneNumber),
        }),
      ]);

      // Create result based on database findings
      const result: CachedCallResult = {
        isSpam: blacklisted?.type === 'blacklist' || (spamReport?.confirmations || 0) > 2,
        confidence: blacklisted ? 1.0 : spamReport ? (spamReport.confirmations || 0) / 3 : 0,
        lastUpdated: Date.now(),
        metadata: {
          source: blacklisted ? 'blacklist' : spamReport ? 'spam_reports' : 'new_number',
          reportCount: spamReport?.confirmations || 0,
          category: spamReport?.category || null,
        },
      };

      // Cache the result
      this.cache.set(phoneNumber, result);
      return result;
    } catch (error) {
      console.error('Error fetching call result from database:', error);
      return null;
    }
  }

  async updateCallResult(phoneNumber: string, result: Omit<CachedCallResult, 'lastUpdated'>): Promise<void> {
    const updatedResult: CachedCallResult = {
      ...result,
      lastUpdated: Date.now(),
    };
    this.cache.set(phoneNumber, updatedResult);
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: this.cache.getRatio(),
    };
  }
}
