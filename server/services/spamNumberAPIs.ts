/**
 * Spam Number API Integration Service
 * Integrates with multiple external APIs to check phone numbers against spam databases
 */

import { logger } from '../utils/logger.js';

interface SpamCheckResult {
    isSpam: boolean;
    confidence: number;
    sources: string[];
    spamType: string[];
    reportCount: number;
    lastReported?: Date;
    details: string;
}

interface APIResponse {
    source: string;
    isSpam: boolean;
    confidence: number;
    spamType: string[];
    reportCount: number;
    details: string;
}

export class SpamNumberAPIService {
    private apiCache = new Map<string, { result: SpamCheckResult; timestamp: number }>();
    private cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    private rateLimits = new Map<string, { count: number; resetTime: number }>();

    // API Configuration
    private apis = {
        // Free APIs
        numverify: {
            enabled: false,
            apiKey: process.env.NUMVERIFY_API_KEY || '',
            baseUrl: 'http://apilayer.net/api/validate',
            rateLimit: 250, // requests per month (free tier)
        },
        numLookupApi: {
            enabled: true,
            baseUrl: 'https://www.numlookupapi.com/api/validate',
            apiKey: process.env.NUMLOOKUP_API_KEY || '',
            rateLimit: 100 // requests per month (free tier)
        },
        // FTC Do Not Call Registry (via unofficial API)
        ftcDNC: {
            enabled: true,
            baseUrl: 'https://www.ftc.gov/policy-notices/open-government/data-sets',
            // Note: FTC data requires downloading bulk files
        },
        // Twilio Lookup API (commercial but has free tier)
        twilioLookup: {
            enabled: false,
            accountSid: process.env.TWILIO_ACCOUNT_SID || '',
            authToken: process.env.TWILIO_AUTH_TOKEN || '',
            baseUrl: 'https://lookups.twilio.com/v1/PhoneNumbers',
            rateLimit: 1000 // depends on your Twilio plan
        },
        // Community-based APIs
        shouldIAnswer: {
            enabled: true,
            baseUrl: 'https://www.shouldianswer.com/phone-number',
            // Web scraping approach (free but use respectfully)
        },
        whoCallsMe: {
            enabled: true,
            baseUrl: 'https://www.whocallsme.com/Phone-Number.aspx',
            // Web scraping approach
        },
        // Commercial APIs with free tiers
        numverifyAPI: {
            enabled: false,
            apiKey: process.env.NUMVERIFY_PRO_API_KEY || '',
            baseUrl: 'https://api.apilayer.com/number_verification/validate',
            rateLimit: 10000 // pro tier
        },
        // Open-source community databases
        phoneSpamFilter: {
            enabled: true,
            baseUrl: 'https://phonevalidator.com/api/v1',
            apiKey: process.env.PHONE_SPAM_FILTER_KEY || '',
        },
        // CTIA Short Code Directory (for SMS spam)
        ctiaShortCode: {
            enabled: true,
            baseUrl: 'https://www.usshortcodes.com/api',
        }
    };

    constructor() {
        this.initializeAPIs();
    }

    private initializeAPIs(): void {
        logger.info('Initializing spam number API integrations');
        
        // Check which APIs are configured
        const enabledAPIs = Object.entries(this.apis)
            .filter(([_, config]) => config.enabled)
            .map(([name, _]) => name);
        
        logger.info(`Enabled spam detection APIs: ${enabledAPIs.join(', ')}`);
    }

    /**
     * Check a phone number against all available spam databases
     */
    async checkNumber(phoneNumber: string): Promise<SpamCheckResult> {
        try {
            // Clean phone number
            const cleanNumber = this.cleanPhoneNumber(phoneNumber);
            
            // Check cache first
            const cached = this.getCachedResult(cleanNumber);
            if (cached) {
                logger.debug(`Cache hit for ${cleanNumber}`);
                return cached;
            }

            // Query all enabled APIs in parallel
            const apiPromises: Promise<APIResponse | null>[] = [];

            if (this.apis.twilioLookup.enabled && this.apis.twilioLookup.accountSid) {
                apiPromises.push(this.checkTwilio(cleanNumber));
            }

            if (this.apis.numverify.enabled && this.apis.numverify.apiKey) {
                apiPromises.push(this.checkNumverify(cleanNumber));
            }

            if (this.apis.numLookupApi.enabled) {
                apiPromises.push(this.checkNumLookupAPI(cleanNumber));
            }

            if (this.apis.shouldIAnswer.enabled) {
                apiPromises.push(this.checkShouldIAnswer(cleanNumber));
            }

            if (this.apis.whoCallsMe.enabled) {
                apiPromises.push(this.checkWhoCallsMe(cleanNumber));
            }

            if (this.apis.phoneSpamFilter.enabled) {
                apiPromises.push(this.checkPhoneSpamFilter(cleanNumber));
            }

            // Wait for all API responses
            const results = await Promise.allSettled(apiPromises);
            
            // Process results
            const validResults: APIResponse[] = results
                .filter((r): r is PromiseFulfilledResult<APIResponse> => 
                    r.status === 'fulfilled' && r.value !== null)
                .map(r => r.value);

            // Aggregate results
            const aggregated = this.aggregateResults(validResults, cleanNumber);
            
            // Cache result
            this.cacheResult(cleanNumber, aggregated);
            
            return aggregated;

        } catch (error) {
            logger.error(`Error checking spam number ${phoneNumber}:`, error as Error);
            return this.createUnknownResult();
        }
    }

    /**
     * Twilio Lookup API - Carrier info and spam detection
     */
    private async checkTwilio(phoneNumber: string): Promise<APIResponse | null> {
        if (!this.checkRateLimit('twilio')) return null;

        try {
            const auth = Buffer.from(
                `${this.apis.twilioLookup.accountSid}:${this.apis.twilioLookup.authToken}`
            ).toString('base64');

            const response = await fetch(
                `${this.apis.twilioLookup.baseUrl}/${encodeURIComponent(phoneNumber)}?Type=carrier&Type=caller-name`,
                {
                    headers: {
                        'Authorization': `Basic ${auth}`
                    }
                }
            );

            if (!response.ok) {
                logger.warn(`Twilio API error: ${response.status}`);
                return null;
            }

            const data = await response.json();
            
            // Twilio doesn't directly flag spam, but carrier type can indicate VoIP/suspicious
            const isVoIP = data.carrier?.type === 'voip';
            const isSuspicious = isVoIP || data.carrier?.type === 'unknown';

            return {
                source: 'Twilio',
                isSpam: false, // Twilio doesn't provide spam data directly
                confidence: 0.3,
                spamType: isSuspicious ? ['voip'] : [],
                reportCount: 0,
                details: `Carrier: ${data.carrier?.name || 'Unknown'}, Type: ${data.carrier?.type || 'Unknown'}`
            };

        } catch (error) {
            logger.error('Twilio API error:', error as Error);
            return null;
        }
    }

    /**
     * Numverify API - Phone validation and carrier lookup
     */
    private async checkNumverify(phoneNumber: string): Promise<APIResponse | null> {
        if (!this.checkRateLimit('numverify')) return null;

        try {
            const response = await fetch(
                `${this.apis.numverify.baseUrl}?access_key=${this.apis.numverify.apiKey}&number=${phoneNumber}&format=1`
            );

            if (!response.ok) return null;

            const data = await response.json();

            return {
                source: 'Numverify',
                isSpam: false, // Basic validation only
                confidence: 0.2,
                spamType: [],
                reportCount: 0,
                details: `Valid: ${data.valid}, Carrier: ${data.carrier || 'Unknown'}, Line Type: ${data.line_type || 'Unknown'}`
            };

        } catch (error) {
            logger.error('Numverify API error:', error as Error);
            return null;
        }
    }

    /**
     * NumLookup API - Spam detection database
     */
    private async checkNumLookupAPI(phoneNumber: string): Promise<APIResponse | null> {
        if (!this.checkRateLimit('numlookup')) return null;

        try {
            // NumLookup API integration
            const response = await fetch(
                `${this.apis.numLookupApi.baseUrl}/${phoneNumber}`,
                {
                    headers: {
                        'apikey': this.apis.numLookupApi.apiKey
                    }
                }
            );

            if (!response.ok) return null;

            const data = await response.json();

            return {
                source: 'NumLookup',
                isSpam: data.spam_score > 0.5,
                confidence: data.spam_score || 0,
                spamType: data.spam_type ? [data.spam_type] : [],
                reportCount: data.report_count || 0,
                details: data.description || 'No details available'
            };

        } catch (error) {
            logger.error('NumLookup API error:', error as Error);
            return null;
        }
    }

    /**
     * Should I Answer - Community-based spam database
     */
    private async checkShouldIAnswer(phoneNumber: string): Promise<APIResponse | null> {
        if (!this.checkRateLimit('shouldianswer')) return null;

        try {
            // This is a web scraping approach - use respectfully
            const response = await fetch(
                `${this.apis.shouldIAnswer.baseUrl}/${phoneNumber.replace(/\D/g, '')}`
            );

            if (!response.ok) return null;

            const html = await response.text();
            
            // Parse HTML for spam indicators
            const isSpam = html.includes('negative rating') || 
                          html.includes('spam') || 
                          html.includes('telemarketer');
            
            const reportMatch = html.match(/(\d+)\s+reports?/i);
            const reportCount = reportMatch ? parseInt(reportMatch[1]) : 0;

            return {
                source: 'ShouldIAnswer',
                isSpam,
                confidence: isSpam ? 0.7 : 0.3,
                spamType: isSpam ? ['telemarketer'] : [],
                reportCount,
                details: `Community reports: ${reportCount}`
            };

        } catch (error) {
            logger.error('ShouldIAnswer scraping error:', error as Error);
            return null;
        }
    }

    /**
     * WhoCallsMe - Community spam reports
     */
    private async checkWhoCallsMe(phoneNumber: string): Promise<APIResponse | null> {
        if (!this.checkRateLimit('whocallsme')) return null;

        try {
            const cleanNum = phoneNumber.replace(/\D/g, '');
            const response = await fetch(
                `${this.apis.whoCallsMe.baseUrl}/${cleanNum}`
            );

            if (!response.ok) return null;

            const html = await response.text();
            
            const isSpam = html.includes('scam') || 
                          html.includes('spam') || 
                          html.includes('robocall');
            
            const scoreMatch = html.match(/score[:\s]+(\d+)/i);
            const score = scoreMatch ? parseInt(scoreMatch[1]) / 100 : 0;

            return {
                source: 'WhoCallsMe',
                isSpam,
                confidence: score,
                spamType: isSpam ? ['spam'] : [],
                reportCount: 0,
                details: `Spam score: ${score}`
            };

        } catch (error) {
            logger.error('WhoCallsMe scraping error:', error as Error);
            return null;
        }
    }

    /**
     * Phone Spam Filter API
     */
    private async checkPhoneSpamFilter(phoneNumber: string): Promise<APIResponse | null> {
        if (!this.checkRateLimit('phonespamfilter')) return null;

        try {
            const response = await fetch(
                `${this.apis.phoneSpamFilter.baseUrl}/number/${phoneNumber}`,
                {
                    headers: {
                        'X-API-Key': this.apis.phoneSpamFilter.apiKey
                    }
                }
            );

            if (!response.ok) return null;

            const data = await response.json();

            return {
                source: 'PhoneSpamFilter',
                isSpam: data.is_spam || false,
                confidence: data.spam_score || 0,
                spamType: data.categories || [],
                reportCount: data.reports || 0,
                details: data.description || 'No details'
            };

        } catch (error) {
            logger.error('PhoneSpamFilter API error:', error as Error);
            return null;
        }
    }

    /**
     * Aggregate results from multiple sources
     */
    private aggregateResults(results: APIResponse[], phoneNumber: string): SpamCheckResult {
        if (results.length === 0) {
            return this.createUnknownResult();
        }

        // Calculate weighted average
        const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);
        const avgConfidence = totalConfidence / results.length;

        // Determine if spam based on majority vote
        const spamVotes = results.filter(r => r.isSpam).length;
        const isSpam = spamVotes > results.length / 2;

        // Collect all spam types
        const spamTypes = new Set<string>();
        results.forEach(r => r.spamType.forEach(type => spamTypes.add(type)));

        // Sum report counts
        const totalReports = results.reduce((sum, r) => sum + r.reportCount, 0);

        // Collect sources
        const sources = results.map(r => r.source);

        return {
            isSpam,
            confidence: avgConfidence,
            sources,
            spamType: Array.from(spamTypes),
            reportCount: totalReports,
            details: `Checked against ${sources.length} source(s): ${sources.join(', ')}. ${
                isSpam ? `Reported as spam by ${spamVotes} source(s).` : 'No spam indicators found.'
            }`
        };
    }

    /**
     * Clean phone number to standard format
     */
    private cleanPhoneNumber(phoneNumber: string): string {
        // Remove all non-digit characters
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        // Add country code if missing (assume US +1)
        if (cleaned.length === 10) {
            cleaned = '1' + cleaned;
        }
        
        return cleaned;
    }

    /**
     * Check rate limit for API
     */
    private checkRateLimit(apiName: string): boolean {
        const now = Date.now();
        const limit = this.rateLimits.get(apiName);

        if (!limit) {
            this.rateLimits.set(apiName, { count: 1, resetTime: now + 60000 }); // 1 minute
            return true;
        }

        if (now > limit.resetTime) {
            // Reset counter
            this.rateLimits.set(apiName, { count: 1, resetTime: now + 60000 });
            return true;
        }

        // Check if under limit (max 10 requests per minute per API)
        if (limit.count < 10) {
            limit.count++;
            return true;
        }

        logger.warn(`Rate limit exceeded for ${apiName}`);
        return false;
    }

    /**
     * Get cached result if available and fresh
     */
    private getCachedResult(phoneNumber: string): SpamCheckResult | null {
        const cached = this.apiCache.get(phoneNumber);
        
        if (!cached) return null;
        
        const age = Date.now() - cached.timestamp;
        if (age > this.cacheExpiry) {
            this.apiCache.delete(phoneNumber);
            return null;
        }
        
        return cached.result;
    }

    /**
     * Cache result
     */
    private cacheResult(phoneNumber: string, result: SpamCheckResult): void {
        this.apiCache.set(phoneNumber, {
            result,
            timestamp: Date.now()
        });
    }

    /**
     * Create unknown result
     */
    private createUnknownResult(): SpamCheckResult {
        return {
            isSpam: false,
            confidence: 0,
            sources: [],
            spamType: [],
            reportCount: 0,
            details: 'No data available from external sources'
        };
    }

    /**
     * Bulk check multiple numbers
     */
    async checkBulk(phoneNumbers: string[]): Promise<Map<string, SpamCheckResult>> {
        const results = new Map<string, SpamCheckResult>();
        
        // Process in batches to avoid overwhelming APIs
        const batchSize = 10;
        for (let i = 0; i < phoneNumbers.length; i += batchSize) {
            const batch = phoneNumbers.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(num => this.checkNumber(num))
            );
            
            batch.forEach((num, index) => {
                results.set(num, batchResults[index]);
            });
            
            // Wait 1 second between batches to respect rate limits
            if (i + batchSize < phoneNumbers.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return results;
    }

    /**
     * Get statistics about API usage
     */
    getStats(): any {
        return {
            cacheSize: this.apiCache.size,
            rateLimitStatus: Object.fromEntries(this.rateLimits.entries()),
            enabledAPIs: Object.entries(this.apis)
                .filter(([_, config]) => config.enabled)
                .map(([name, _]) => name)
        };
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.apiCache.clear();
        logger.info('API cache cleared');
    }
}

export default SpamNumberAPIService;
