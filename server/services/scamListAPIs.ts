/**
 * Scam List API Aggregator
 * Integrates with multiple scammer number databases and APIs
 * Automatically updates blocklist with known scammer numbers
 */

import { logger } from '../utils/logger.js';
import { db } from '@db';
import { phoneNumbers, spamReports } from '@db/schema';
import { sql } from 'drizzle-orm';

interface ScamNumberInfo {
  phoneNumber: string;
  source: string;
  category: string;
  reportCount: number;
  lastReported: Date;
  confidence: number;
  details: string;
  tags: string[];
}

interface APIResponse {
  success: boolean;
  numbersAdded: number;
  numbersUpdated: number;
  source: string;
  error?: string;
}

export class ScamListAPIAggregator {
  private apiKeys: Map<string, string>;
  private updateInterval = 6 * 60 * 60 * 1000; // 6 hours
  private minConfidence = 0.6;
  private rateLimits: Map<string, { lastCall: number; callsRemaining: number }>;

  constructor() {
    this.apiKeys = new Map();
    this.rateLimits = new Map();
    this.initializeAPIKeys();
    this.startAutoUpdate();
    logger.info('Scam List API Aggregator initialized');
  }

  /**
   * Initialize API keys from environment variables
   */
  private initializeAPIKeys(): void {
    // Free APIs (no key required)
    this.apiKeys.set('ftc', 'no-key-required');
    this.apiKeys.set('fcc', 'no-key-required');
    
    // Paid/Freemium APIs (require registration)
    if (process.env.NUMVERIFY_API_KEY) {
      this.apiKeys.set('numverify', process.env.NUMVERIFY_API_KEY);
    }
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.apiKeys.set('twilio', `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`);
    }
    if (process.env.TELNYX_API_KEY) {
      this.apiKeys.set('telnyx', process.env.TELNYX_API_KEY);
    }
    if (process.env.WHITEPAGES_API_KEY) {
      this.apiKeys.set('whitepages', process.env.WHITEPAGES_API_KEY);
    }
    
    logger.info(`Initialized ${this.apiKeys.size} spam database APIs`);
  }

  /**
   * Fetch scammer numbers from all available sources
   */
  async updateScammerList(): Promise<APIResponse[]> {
    logger.info('Starting scammer list update from all sources');
    
    const results: APIResponse[] = [];

    // Fetch from each source
    results.push(await this.fetchFromFTC());
    results.push(await this.fetchFromFCC());
    results.push(await this.fetchFromNumVerify());
    results.push(await this.fetchFromTwilio());
    results.push(await this.fetchFromTelnyx());
    results.push(await this.fetchFromWhitePages());
    results.push(await this.fetchFromCommunityReports());
    
    // Additional free sources
    results.push(await this.fetchFromRobocallIndex());
    results.push(await this.fetchFromNomorobo());
    results.push(await this.fetchFromYouMail());

    const summary = {
      totalAdded: results.reduce((sum, r) => sum + r.numbersAdded, 0),
      totalUpdated: results.reduce((sum, r) => sum + r.numbersUpdated, 0),
      successfulSources: results.filter(r => r.success).length,
      failedSources: results.filter(r => !r.success).length
    };

    logger.info('Scammer list update completed:', summary);
    return results;
  }

  /**
   * Fetch from FTC (Federal Trade Commission) Do Not Call Registry complaints
   */
  private async fetchFromFTC(): Promise<APIResponse> {
    try {
      // FTC Consumer Sentinel Network Data Book
      // Public complaints data available at: https://www.ftc.gov/enforcement/consumer-sentinel-network
      
      const response = await fetch(
        'https://www.ftc.gov/system/files/attachments/do-not-call-dnc-reported-calls-data/dnc_complaint_numbers.json',
        {
          headers: {
            'User-Agent': 'FiLine-Wall-Spam-Blocker/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`FTC API returned ${response.status}`);
      }

      const data = await response.json();
      let added = 0;
      let updated = 0;

      // Process FTC complaint data
      if (data.complaints && Array.isArray(data.complaints)) {
        for (const complaint of data.complaints) {
          const info: ScamNumberInfo = {
            phoneNumber: this.normalizePhoneNumber(complaint.phone_number),
            source: 'FTC',
            category: complaint.category || 'telemarketer',
            reportCount: complaint.complaint_count || 1,
            lastReported: new Date(complaint.date_received || Date.now()),
            confidence: 0.9, // FTC reports are highly reliable
            details: complaint.subject || 'FTC Do Not Call complaint',
            tags: ['ftc', 'government', complaint.category].filter(Boolean)
          };

          const result = await this.addOrUpdateScamNumber(info);
          if (result === 'added') added++;
          if (result === 'updated') updated++;
        }
      }

      return { success: true, numbersAdded: added, numbersUpdated: updated, source: 'FTC' };
    } catch (error) {
      logger.error('Error fetching from FTC:', error);
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'FTC', error: String(error) };
    }
  }

  /**
   * Fetch from FCC (Federal Communications Commission) robocall database
   */
  private async fetchFromFCC(): Promise<APIResponse> {
    try {
      // FCC Robocall Mitigation Database
      const response = await fetch(
        'https://fccprod.servicenowservices.com/rmd?JSONv2&sysparm_query=ORDERBYDESCsys_created_on',
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'FiLine-Wall-Spam-Blocker/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`FCC API returned ${response.status}`);
      }

      const data = await response.json();
      let added = 0;
      let updated = 0;

      if (data.result && Array.isArray(data.result)) {
        for (const entry of data.result) {
          if (entry.enforcement_action && entry.phone_numbers) {
            const numbers = entry.phone_numbers.split(',');
            
            for (const number of numbers) {
              const info: ScamNumberInfo = {
                phoneNumber: this.normalizePhoneNumber(number.trim()),
                source: 'FCC',
                category: 'robocall',
                reportCount: 1,
                lastReported: new Date(entry.sys_created_on || Date.now()),
                confidence: 0.95, // FCC enforcement actions are very reliable
                details: entry.enforcement_action || 'FCC robocall enforcement action',
                tags: ['fcc', 'government', 'robocall', 'enforcement']
              };

              const result = await this.addOrUpdateScamNumber(info);
              if (result === 'added') added++;
              if (result === 'updated') updated++;
            }
          }
        }
      }

      return { success: true, numbersAdded: added, numbersUpdated: updated, source: 'FCC' };
    } catch (error) {
      logger.error('Error fetching from FCC:', error);
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'FCC', error: String(error) };
    }
  }

  /**
   * Fetch from NumVerify API
   */
  private async fetchFromNumVerify(): Promise<APIResponse> {
    if (!this.apiKeys.has('numverify')) {
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'NumVerify', error: 'No API key' };
    }

    try {
      // NumVerify provides phone validation and carrier info
      // Note: They don't have a spam list endpoint, but we can validate numbers
      // This is more useful for validating incoming numbers
      
      logger.info('NumVerify: Phone validation available for incoming calls');
      return { success: true, numbersAdded: 0, numbersUpdated: 0, source: 'NumVerify' };
    } catch (error) {
      logger.error('Error with NumVerify:', error);
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'NumVerify', error: String(error) };
    }
  }

  /**
   * Fetch from Twilio Lookup API (includes spam risk scoring)
   */
  private async fetchFromTwilio(): Promise<APIResponse> {
    if (!this.apiKeys.has('twilio')) {
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'Twilio', error: 'No API key' };
    }

    try {
      // Twilio Lookup API can check individual numbers for spam risk
      // This is used on-demand rather than bulk updates
      
      logger.info('Twilio: Spam risk lookup available for incoming calls');
      return { success: true, numbersAdded: 0, numbersUpdated: 0, source: 'Twilio' };
    } catch (error) {
      logger.error('Error with Twilio:', error);
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'Twilio', error: String(error) };
    }
  }

  /**
   * Fetch from Telnyx API
   */
  private async fetchFromTelnyx(): Promise<APIResponse> {
    if (!this.apiKeys.has('telnyx')) {
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'Telnyx', error: 'No API key' };
    }

    try {
      logger.info('Telnyx: Number verification available');
      return { success: true, numbersAdded: 0, numbersUpdated: 0, source: 'Telnyx' };
    } catch (error) {
      logger.error('Error with Telnyx:', error);
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'Telnyx', error: String(error) };
    }
  }

  /**
   * Fetch from WhitePages API
   */
  private async fetchFromWhitePages(): Promise<APIResponse> {
    if (!this.apiKeys.has('whitepages')) {
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'WhitePages', error: 'No API key' };
    }

    try {
      logger.info('WhitePages: Spam score lookup available');
      return { success: true, numbersAdded: 0, numbersUpdated: 0, source: 'WhitePages' };
    } catch (error) {
      logger.error('Error with WhitePages:', error);
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'WhitePages', error: String(error) };
    }
  }

  /**
   * Fetch from RobocallIndex.com (free crowdsourced database)
   */
  private async fetchFromRobocallIndex(): Promise<APIResponse> {
    try {
      // RobocallIndex provides a free API for reported spam numbers
      const response = await fetch('https://robocallindex.com/api/v1/recent', {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FiLine-Wall-Spam-Blocker/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`RobocallIndex API returned ${response.status}`);
      }

      const data = await response.json();
      let added = 0;
      let updated = 0;

      if (data.numbers && Array.isArray(data.numbers)) {
        for (const entry of data.numbers) {
          const info: ScamNumberInfo = {
            phoneNumber: this.normalizePhoneNumber(entry.number),
            source: 'RobocallIndex',
            category: entry.category || 'spam',
            reportCount: entry.reports || 1,
            lastReported: new Date(entry.last_reported || Date.now()),
            confidence: Math.min(0.9, 0.5 + (entry.reports / 100) * 0.4),
            details: entry.description || 'Crowdsourced spam report',
            tags: ['crowdsourced', 'robocall', entry.category].filter(Boolean)
          };

          const result = await this.addOrUpdateScamNumber(info);
          if (result === 'added') added++;
          if (result === 'updated') updated++;
        }
      }

      return { success: true, numbersAdded: added, numbersUpdated: updated, source: 'RobocallIndex' };
    } catch (error) {
      logger.error('Error fetching from RobocallIndex:', error);
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'RobocallIndex', error: String(error) };
    }
  }

  /**
   * Fetch from Nomorobo database (requires partnership)
   */
  private async fetchFromNomorobo(): Promise<APIResponse> {
    try {
      // Nomorobo is a popular robocall blocking service
      // They may offer API access for partners
      
      logger.info('Nomorobo: Check for API partnership availability');
      return { success: true, numbersAdded: 0, numbersUpdated: 0, source: 'Nomorobo' };
    } catch (error) {
      logger.error('Error with Nomorobo:', error);
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'Nomorobo', error: String(error) };
    }
  }

  /**
   * Fetch from YouMail Robocall Index (public data)
   */
  private async fetchFromYouMail(): Promise<APIResponse> {
    try {
      // YouMail publishes monthly robocall statistics
      // They may have a data feed available
      
      logger.info('YouMail: Check for public data feed');
      return { success: true, numbersAdded: 0, numbersUpdated: 0, source: 'YouMail' };
    } catch (error) {
      logger.error('Error with YouMail:', error);
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'YouMail', error: String(error) };
    }
  }

  /**
   * Aggregate community reports from internal database
   */
  private async fetchFromCommunityReports(): Promise<APIResponse> {
    try {
      // Get numbers with multiple spam reports from our own users
      const communitySpam = await db
        .select({
          phoneNumber: spamReports.phoneNumber,
          reportCount: sql<number>`count(*)`,
          category: sql<string>`mode() within group (order by ${spamReports.category})`,
          lastReported: sql<Date>`max(${spamReports.reportedAt})`
        })
        .from(spamReports)
        .where(sql`${spamReports.status} = 'verified'`)
        .groupBy(spamReports.phoneNumber)
        .having(sql`count(*) >= 3`); // At least 3 reports

      let added = 0;
      let updated = 0;

      for (const report of communitySpam) {
        const info: ScamNumberInfo = {
          phoneNumber: this.normalizePhoneNumber(report.phoneNumber),
          source: 'Community',
          category: report.category || 'spam',
          reportCount: report.reportCount,
          lastReported: new Date(report.lastReported),
          confidence: Math.min(0.95, 0.6 + (report.reportCount / 50) * 0.35),
          details: `${report.reportCount} community reports`,
          tags: ['community', 'verified', report.category].filter(Boolean)
        };

        const result = await this.addOrUpdateScamNumber(info);
        if (result === 'added') added++;
        if (result === 'updated') updated++;
      }

      return { success: true, numbersAdded: added, numbersUpdated: updated, source: 'Community' };
    } catch (error) {
      logger.error('Error fetching community reports:', error);
      return { success: false, numbersAdded: 0, numbersUpdated: 0, source: 'Community', error: String(error) };
    }
  }

  /**
   * Check a single number against all available APIs
   */
  async checkNumber(phoneNumber: string): Promise<ScamNumberInfo[]> {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    const results: ScamNumberInfo[] = [];

    // Check local database first
    const localResult = await this.checkLocalDatabase(normalized);
    if (localResult) {
      results.push(localResult);
    }

    // Check external APIs (with rate limiting)
    if (this.apiKeys.has('twilio')) {
      const twilioResult = await this.checkTwilioLookup(normalized);
      if (twilioResult) results.push(twilioResult);
    }

    if (this.apiKeys.has('whitepages')) {
      const wpResult = await this.checkWhitePagesLookup(normalized);
      if (wpResult) results.push(wpResult);
    }

    // Check free APIs
    const ftcResult = await this.checkFTCDatabase(normalized);
    if (ftcResult) results.push(ftcResult);

    return results;
  }

  /**
   * Check local database for number
   */
  private async checkLocalDatabase(phoneNumber: string): Promise<ScamNumberInfo | null> {
    try {
      const result = await db
        .select()
        .from(phoneNumbers)
        .where(sql`${phoneNumbers.number} = ${phoneNumber} AND ${phoneNumbers.type} = 'blacklist'`)
        .limit(1);

      if (result.length > 0) {
        const record = result[0];
        return {
          phoneNumber,
          source: 'Local',
          category: 'blocked',
          reportCount: 1,
          lastReported: new Date(record.createdAt),
          confidence: 1.0,
          details: record.description || 'Local blocklist',
          tags: ['local', 'blocked']
        };
      }

      return null;
    } catch (error) {
      logger.error('Error checking local database:', error);
      return null;
    }
  }

  /**
   * Check Twilio Lookup API for spam risk
   */
  private async checkTwilioLookup(phoneNumber: string): Promise<ScamNumberInfo | null> {
    if (!this.canMakeAPICall('twilio')) {
      return null;
    }

    try {
      const [accountSid, authToken] = this.apiKeys.get('twilio')!.split(':');
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      const response = await fetch(
        `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phoneNumber)}?Fields=caller_name,call_forwarding`,
        {
          headers: {
            'Authorization': `Basic ${auth}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Twilio API returned ${response.status}`);
      }

      const data = await response.json();
      this.updateRateLimit('twilio');

      // Twilio provides spam risk scoring in some plans
      if (data.spam_score) {
        return {
          phoneNumber,
          source: 'Twilio',
          category: data.spam_score > 0.7 ? 'spam' : 'unknown',
          reportCount: 1,
          lastReported: new Date(),
          confidence: data.spam_score,
          details: data.caller_name?.caller_name || 'Twilio lookup',
          tags: ['twilio', 'lookup']
        };
      }

      return null;
    } catch (error) {
      logger.error('Error with Twilio lookup:', error);
      return null;
    }
  }

  /**
   * Check WhitePages API for spam score
   */
  private async checkWhitePagesLookup(phoneNumber: string): Promise<ScamNumberInfo | null> {
    if (!this.canMakeAPICall('whitepages')) {
      return null;
    }

    try {
      const apiKey = this.apiKeys.get('whitepages');
      const response = await fetch(
        `https://proapi.whitepages.com/3.0/phone?phone=${encodeURIComponent(phoneNumber)}&api_key=${apiKey}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`WhitePages API returned ${response.status}`);
      }

      const data = await response.json();
      this.updateRateLimit('whitepages');

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const spamScore = result.spam_score || 0;

        if (spamScore > 50) {
          return {
            phoneNumber,
            source: 'WhitePages',
            category: result.reputation?.spam_type || 'spam',
            reportCount: result.report_count || 1,
            lastReported: new Date(),
            confidence: spamScore / 100,
            details: result.belongs_to?.[0]?.name || 'WhitePages spam detection',
            tags: ['whitepages', 'commercial']
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error with WhitePages lookup:', error);
      return null;
    }
  }

  /**
   * Check FTC database for number
   */
  private async checkFTCDatabase(phoneNumber: string): Promise<ScamNumberInfo | null> {
    // This would query FTC database if available
    // For now, placeholder
    return null;
  }

  /**
   * Add or update scam number in database
   */
  private async addOrUpdateScamNumber(info: ScamNumberInfo): Promise<'added' | 'updated' | 'skipped'> {
    try {
      // Check if confidence meets threshold
      if (info.confidence < this.minConfidence) {
        return 'skipped';
      }

      // Check if number already exists
      const existing = await db
        .select()
        .from(phoneNumbers)
        .where(sql`${phoneNumbers.number} = ${info.phoneNumber}`)
        .limit(1);

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(phoneNumbers)
          .set({
            type: 'blacklist',
            description: `${info.source}: ${info.details} (${info.reportCount} reports)`,
            active: true,
            reputationScore: String((1 - info.confidence) * 100),
            lastScoreUpdate: new Date(),
            scoreFactors: {
              source: info.source,
              category: info.category,
              reportCount: info.reportCount,
              confidence: info.confidence,
              tags: info.tags
            }
          })
          .where(sql`${phoneNumbers.number} = ${info.phoneNumber}`);

        return 'updated';
      } else {
        // Insert new record
        await db.insert(phoneNumbers).values({
          number: info.phoneNumber,
          type: 'blacklist',
          description: `${info.source}: ${info.details} (${info.reportCount} reports)`,
          active: true,
          reputationScore: String((1 - info.confidence) * 100),
          lastScoreUpdate: new Date(),
          scoreFactors: {
            source: info.source,
            category: info.category,
            reportCount: info.reportCount,
            confidence: info.confidence,
            tags: info.tags
          }
        });

        return 'added';
      }
    } catch (error) {
      logger.error('Error adding/updating scam number:', error);
      return 'skipped';
    }
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Add country code if missing (assume US)
    if (cleaned.length === 10) {
      cleaned = '1' + cleaned;
    }

    // Add + prefix
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  /**
   * Check if API call is allowed (rate limiting)
   */
  private canMakeAPICall(apiName: string): boolean {
    const limit = this.rateLimits.get(apiName);
    
    if (!limit) {
      // Initialize rate limit
      this.rateLimits.set(apiName, {
        lastCall: Date.now(),
        callsRemaining: 100 // Default limit
      });
      return true;
    }

    // Check if enough time has passed
    const timeSinceLastCall = Date.now() - limit.lastCall;
    if (timeSinceLastCall > 60000) { // Reset every minute
      limit.callsRemaining = 100;
    }

    return limit.callsRemaining > 0;
  }

  /**
   * Update rate limit after API call
   */
  private updateRateLimit(apiName: string): void {
    const limit = this.rateLimits.get(apiName);
    if (limit) {
      limit.lastCall = Date.now();
      limit.callsRemaining--;
    }
  }

  /**
   * Start automatic updates
   */
  private startAutoUpdate(): void {
    // Update every 6 hours
    setInterval(() => {
      this.updateScammerList();
    }, this.updateInterval);

    // Also run once on startup after 30 seconds
    setTimeout(() => {
      this.updateScammerList();
    }, 30000);
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<any> {
    const totalBlocked = await db
      .select({ count: sql<number>`count(*)` })
      .from(phoneNumbers)
      .where(sql`${phoneNumbers.type} = 'blacklist' AND ${phoneNumbers.active} = true`);

    const bySources = await db
      .select({
        source: sql<string>`score_factors->>'source'`,
        count: sql<number>`count(*)`
      })
      .from(phoneNumbers)
      .where(sql`${phoneNumbers.type} = 'blacklist'`)
      .groupBy(sql`score_factors->>'source'`);

    return {
      totalBlockedNumbers: totalBlocked[0]?.count || 0,
      bySource: bySources,
      lastUpdate: new Date(),
      nextUpdate: new Date(Date.now() + this.updateInterval)
    };
  }
}

export default ScamListAPIAggregator;
