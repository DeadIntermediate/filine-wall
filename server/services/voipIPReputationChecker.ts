/**
 * VoIP IP Reputation Checker
 * Validates VoIP call origin IP addresses against blacklists
 * Detects calls from suspicious VoIP providers and regions
 */

interface IPReputationResult {
  ipAddress: string | null;
  isBlacklisted: boolean;
  reputationScore: number;
  provider: string | null;
  country: string | null;
  blacklistSources: string[];
  warnings: string[];
  riskScore: number;
}

interface BlacklistSource {
  name: string;
  url: string;
  weight: number;
}

export class VoIPIPReputationChecker {
  private developmentMode: boolean;
  private blacklistSources: BlacklistSource[];
  private ipCache: Map<string, { result: IPReputationResult; timestamp: number }>;
  private cacheExpiry: number = 3600000; // 1 hour

  constructor(developmentMode = false) {
    this.developmentMode = developmentMode;
    this.ipCache = new Map();
    
    this.blacklistSources = [
      {
        name: 'Spamhaus',
        url: 'https://www.spamhaus.org/query/ip/',
        weight: 0.3
      },
      {
        name: 'StopForumSpam',
        url: 'https://api.stopforumspam.org/api',
        weight: 0.2
      },
      {
        name: 'AbuseIPDB',
        url: 'https://api.abuseipdb.com/api/v2/check',
        weight: 0.3
      },
      {
        name: 'VoIPBL',
        url: 'https://voipbl.org/check/',
        weight: 0.2
      }
    ];
  }

  /**
   * Check VoIP IP reputation
   */
  async checkIPReputation(
    ipAddress: string | null,
    sipHeaders?: any
  ): Promise<IPReputationResult> {
    if (this.developmentMode) {
      return this.mockIPReputation(ipAddress);
    }

    if (!ipAddress) {
      // Try to extract IP from SIP headers
      ipAddress = this.extractIPFromSIPHeaders(sipHeaders);
    }

    if (!ipAddress) {
      return {
        ipAddress: null,
        isBlacklisted: false,
        reputationScore: 0.5,
        provider: null,
        country: null,
        blacklistSources: [],
        warnings: ['No IP address available'],
        riskScore: 0.5
      };
    }

    // Check cache
    const cached = this.ipCache.get(ipAddress);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.result;
    }

    try {
      // Check all blacklist sources in parallel
      const blacklistChecks = await Promise.all(
        this.blacklistSources.map(source => this.checkBlacklist(ipAddress!, source))
      );

      // Get IP info (geolocation, provider)
      const ipInfo = await this.getIPInfo(ipAddress);

      // Calculate reputation score
      const blacklistedSources = blacklistChecks
        .filter(check => check.isListed)
        .map(check => check.source.name);

      const reputationScore = this.calculateReputationScore(blacklistChecks, ipInfo);
      const warnings = this.generateWarnings(blacklistChecks, ipInfo);
      const riskScore = this.calculateRiskScore(reputationScore, blacklistedSources.length, ipInfo);

      const result: IPReputationResult = {
        ipAddress,
        isBlacklisted: blacklistedSources.length > 0,
        reputationScore,
        provider: ipInfo.provider,
        country: ipInfo.country,
        blacklistSources: blacklistedSources,
        warnings,
        riskScore
      };

      // Cache result
      this.ipCache.set(ipAddress, { result, timestamp: Date.now() });

      return result;
    } catch (error) {
      console.error('IP reputation check error:', error);
      return {
        ipAddress,
        isBlacklisted: false,
        reputationScore: 0.5,
        provider: null,
        country: null,
        blacklistSources: [],
        warnings: ['Reputation check failed'],
        riskScore: 0.5
      };
    }
  }

  /**
   * Extract IP address from SIP headers
   */
  private extractIPFromSIPHeaders(sipHeaders: any): string | null {
    if (!sipHeaders) return null;

    // Try various SIP header fields
    const fields = [
      'Via',
      'Contact',
      'X-Real-IP',
      'X-Forwarded-For',
      'Received'
    ];

    for (const field of fields) {
      const value = sipHeaders[field];
      if (value) {
        const ipMatch = value.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
        if (ipMatch) {
          return ipMatch[0];
        }
      }
    }

    return null;
  }

  /**
   * Check IP against blacklist source
   */
  private async checkBlacklist(
    ipAddress: string,
    source: BlacklistSource
  ): Promise<{ isListed: boolean; source: BlacklistSource; confidence: number }> {
    try {
      switch (source.name) {
        case 'Spamhaus':
          return await this.checkSpamhaus(ipAddress, source);
        case 'StopForumSpam':
          return await this.checkStopForumSpam(ipAddress, source);
        case 'AbuseIPDB':
          return await this.checkAbuseIPDB(ipAddress, source);
        case 'VoIPBL':
          return await this.checkVoIPBL(ipAddress, source);
        default:
          return { isListed: false, source, confidence: 0 };
      }
    } catch (error) {
      console.error(`Blacklist check error (${source.name}):`, error);
      return { isListed: false, source, confidence: 0 };
    }
  }

  /**
   * Check Spamhaus blacklist
   */
  private async checkSpamhaus(
    ipAddress: string,
    source: BlacklistSource
  ): Promise<{ isListed: boolean; source: BlacklistSource; confidence: number }> {
    // DNS-based blacklist check
    const reversedIP = ipAddress.split('.').reverse().join('.');
    const dnsQuery = `${reversedIP}.zen.spamhaus.org`;

    try {
      // In production, use dns.resolve()
      // For now, mock the check
      const isListed = false; // await dnsLookup(dnsQuery);
      return { isListed, source, confidence: isListed ? 0.9 : 0 };
    } catch {
      return { isListed: false, source, confidence: 0 };
    }
  }

  /**
   * Check StopForumSpam
   */
  private async checkStopForumSpam(
    ipAddress: string,
    source: BlacklistSource
  ): Promise<{ isListed: boolean; source: BlacklistSource; confidence: number }> {
    const apiUrl = `${source.url}?ip=${ipAddress}&json`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        return { isListed: false, source, confidence: 0 };
      }

      const data = await response.json();
      const isListed = data.ip?.appears === 1;
      const frequency = data.ip?.frequency || 0;
      const confidence = Math.min(frequency / 10, 1.0);

      return { isListed, source, confidence };
    } catch {
      return { isListed: false, source, confidence: 0 };
    }
  }

  /**
   * Check AbuseIPDB
   */
  private async checkAbuseIPDB(
    ipAddress: string,
    source: BlacklistSource
  ): Promise<{ isListed: boolean; source: BlacklistSource; confidence: number }> {
    const apiKey = process.env.ABUSEIPDB_API_KEY;
    
    if (!apiKey) {
      return { isListed: false, source, confidence: 0 };
    }

    try {
      const response = await fetch(`${source.url}?ipAddress=${ipAddress}`, {
        headers: {
          'Key': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return { isListed: false, source, confidence: 0 };
      }

      const data = await response.json();
      const abuseScore = data.data?.abuseConfidenceScore || 0;
      const isListed = abuseScore > 25;
      const confidence = abuseScore / 100;

      return { isListed, source, confidence };
    } catch {
      return { isListed: false, source, confidence: 0 };
    }
  }

  /**
   * Check VoIPBL
   */
  private async checkVoIPBL(
    ipAddress: string,
    source: BlacklistSource
  ): Promise<{ isListed: boolean; source: BlacklistSource; confidence: number }> {
    const reversedIP = ipAddress.split('.').reverse().join('.');
    const dnsQuery = `${reversedIP}.voipbl.org`;

    try {
      // DNS-based blacklist check
      // In production, use dns.resolve()
      const isListed = false; // await dnsLookup(dnsQuery);
      return { isListed, source, confidence: isListed ? 0.8 : 0 };
    } catch {
      return { isListed: false, source, confidence: 0 };
    }
  }

  /**
   * Get IP geolocation and provider info
   */
  private async getIPInfo(ipAddress: string): Promise<{
    provider: string | null;
    country: string | null;
    isVPN: boolean;
    isProxy: boolean;
    isTor: boolean;
  }> {
    try {
      // Use ip-api.com (free tier)
      const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=isp,country,proxy,hosting`);
      
      if (!response.ok) {
        return { provider: null, country: null, isVPN: false, isProxy: false, isTor: false };
      }

      const data = await response.json();

      return {
        provider: data.isp || null,
        country: data.country || null,
        isVPN: data.hosting || false,
        isProxy: data.proxy || false,
        isTor: false // Would need additional check
      };
    } catch {
      return { provider: null, country: null, isVPN: false, isProxy: false, isTor: false };
    }
  }

  /**
   * Calculate reputation score
   */
  private calculateReputationScore(
    blacklistChecks: Array<{ isListed: boolean; source: BlacklistSource; confidence: number }>,
    ipInfo: { provider: string | null; country: string | null; isVPN: boolean; isProxy: boolean }
  ): number {
    let score = 1.0; // Start with perfect reputation

    // Reduce score based on blacklist hits
    for (const check of blacklistChecks) {
      if (check.isListed) {
        score -= check.source.weight * check.confidence;
      }
    }

    // Additional penalties
    if (ipInfo.isVPN) score -= 0.2;
    if (ipInfo.isProxy) score -= 0.3;

    // High-risk countries (could be configured)
    const highRiskCountries = ['CN', 'RU', 'NG', 'PK', 'IN'];
    if (ipInfo.country && highRiskCountries.includes(ipInfo.country)) {
      score -= 0.15;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate warnings
   */
  private generateWarnings(
    blacklistChecks: Array<{ isListed: boolean; source: BlacklistSource; confidence: number }>,
    ipInfo: { provider: string | null; country: string | null; isVPN: boolean; isProxy: boolean; isTor: boolean }
  ): string[] {
    const warnings: string[] = [];

    // Blacklist warnings
    const listedSources = blacklistChecks.filter(c => c.isListed);
    if (listedSources.length > 0) {
      warnings.push(`Listed in ${listedSources.length} blacklist(s)`);
    }

    // VPN/Proxy warnings
    if (ipInfo.isVPN) warnings.push('Call originated from VPN/hosting provider');
    if (ipInfo.isProxy) warnings.push('Call originated from proxy server');
    if (ipInfo.isTor) warnings.push('Call originated from Tor network');

    // Country warnings
    if (ipInfo.country) {
      const highRiskCountries = ['CN', 'RU', 'NG', 'PK', 'IN'];
      if (highRiskCountries.includes(ipInfo.country)) {
        warnings.push(`Call originated from high-risk country: ${ipInfo.country}`);
      }
    }

    return warnings;
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(
    reputationScore: number,
    blacklistCount: number,
    ipInfo: { isVPN: boolean; isProxy: boolean }
  ): number {
    let risk = 1.0 - reputationScore;

    // Increase risk for multiple blacklist hits
    if (blacklistCount >= 3) risk += 0.2;
    else if (blacklistCount >= 2) risk += 0.1;

    // VPN/Proxy increases risk
    if (ipInfo.isVPN || ipInfo.isProxy) risk += 0.15;

    return Math.min(risk, 0.99);
  }

  /**
   * Development mode mock
   */
  private mockIPReputation(ipAddress: string | null): IPReputationResult {
    if (!ipAddress) {
      ipAddress = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    }

    const hash = ipAddress.split('.').reduce((acc, part) => acc + parseInt(part), 0);
    const scenario = hash % 4;

    const scenarios: IPReputationResult[] = [
      {
        ipAddress,
        isBlacklisted: true,
        reputationScore: 0.2,
        provider: 'Shady VoIP Services Inc.',
        country: 'NG',
        blacklistSources: ['Spamhaus', 'AbuseIPDB', 'VoIPBL'],
        warnings: [
          'Listed in 3 blacklist(s)',
          'Call originated from VPN/hosting provider',
          'Call originated from high-risk country: NG'
        ],
        riskScore: 0.92
      },
      {
        ipAddress,
        isBlacklisted: true,
        reputationScore: 0.55,
        provider: 'Budget VoIP Provider',
        country: 'IN',
        blacklistSources: ['StopForumSpam'],
        warnings: [
          'Listed in 1 blacklist(s)',
          'Call originated from high-risk country: IN'
        ],
        riskScore: 0.58
      },
      {
        ipAddress,
        isBlacklisted: false,
        reputationScore: 0.85,
        provider: 'Legitimate Telecom',
        country: 'US',
        blacklistSources: [],
        warnings: [],
        riskScore: 0.15
      },
      {
        ipAddress,
        isBlacklisted: false,
        reputationScore: 0.95,
        provider: 'Twilio Inc.',
        country: 'US',
        blacklistSources: [],
        warnings: [],
        riskScore: 0.05
      }
    ];

    return scenarios[scenario] || scenarios[2];
  }
}

export default VoIPIPReputationChecker;
