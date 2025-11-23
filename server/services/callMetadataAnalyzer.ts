/**
 * Call Metadata Analyzer
 * Analyzes SIP headers and call metadata for anomalies
 * Detects spoofing attempts and suspicious call patterns
 */

import { logger } from '../utils/logger';

interface SIPHeaderAnalysis {
  hasAnomalies: boolean;
  anomalies: string[];
  spoofingIndicators: string[];
  headerCompleteness: number;
  protocolCompliance: boolean;
  riskScore: number;
}

interface CallMetadata {
  callId?: string;
  fromHeader?: string;
  toHeader?: string;
  via?: string[];
  contact?: string;
  userAgent?: string;
  contentType?: string;
  allow?: string[];
  supported?: string[];
  timestamp?: Date;
  [key: string]: any;
}

export class CallMetadataAnalyzer {
  private developmentMode: boolean;
  private requiredHeaders = ['From', 'To', 'Call-ID', 'CSeq', 'Via'];
  private suspiciousUserAgents = [
    'friendly-scanner',
    'sipcli',
    'sip-scan',
    'sipvicious',
    'iWar',
    'sipsak'
  ];

  constructor(developmentMode = false) {
    this.developmentMode = developmentMode;
  }

  /**
   * Analyze SIP headers and call metadata
   */
  async analyzeMetadata(sipHeaders: CallMetadata): Promise<SIPHeaderAnalysis> {
    if (this.developmentMode) {
      return this.mockMetadataAnalysis();
    }

    try {
      const anomalies: string[] = [];
      const spoofingIndicators: string[] = [];

      // Check header completeness
      const headerCompleteness = this.checkHeaderCompleteness(sipHeaders, anomalies);

      // Check protocol compliance
      const protocolCompliance = this.checkProtocolCompliance(sipHeaders, anomalies);

      // Detect caller ID spoofing
      this.detectCallerIDSpoofing(sipHeaders, spoofingIndicators);

      // Detect Via header manipulation
      this.detectViaManipulation(sipHeaders, anomalies);

      // Check User-Agent
      this.checkUserAgent(sipHeaders, spoofingIndicators, anomalies);

      // Validate From/To headers
      this.validateFromToHeaders(sipHeaders, anomalies);

      // Check for timestamp anomalies
      this.checkTimestampAnomalies(sipHeaders, anomalies);

      // Calculate risk score
      const riskScore = this.calculateRiskScore(
        anomalies.length,
        spoofingIndicators.length,
        headerCompleteness,
        protocolCompliance
      );

      return {
        hasAnomalies: anomalies.length > 0 || spoofingIndicators.length > 0,
        anomalies,
        spoofingIndicators,
        headerCompleteness,
        protocolCompliance,
        riskScore
      };
    } catch (error) {
      console.error('Metadata analysis error:', error);
      return {
        hasAnomalies: false,
        anomalies: ['Analysis failed'],
        spoofingIndicators: [],
        headerCompleteness: 0,
        protocolCompliance: false,
        riskScore: 0.5
      };
    }
  }

  /**
   * Check for required SIP headers
   */
  private checkHeaderCompleteness(metadata: CallMetadata, anomalies: string[]): number {
    let presentHeaders = 0;

    for (const header of this.requiredHeaders) {
      if (metadata[header] || metadata[header.toLowerCase()]) {
        presentHeaders++;
      } else {
        anomalies.push(`Missing required header: ${header}`);
      }
    }

    return presentHeaders / this.requiredHeaders.length;
  }

  /**
   * Check SIP protocol compliance
   */
  private checkProtocolCompliance(metadata: CallMetadata, anomalies: string[]): boolean {
    let isCompliant = true;

    // Check From header format
    if (metadata.fromHeader || metadata.From) {
      const fromHeader = metadata.fromHeader || metadata.From;
      if (!this.isValidSIPAddress(fromHeader)) {
        anomalies.push('Invalid From header format');
        isCompliant = false;
      }
    }

    // Check To header format
    if (metadata.toHeader || metadata.To) {
      const toHeader = metadata.toHeader || metadata.To;
      if (!this.isValidSIPAddress(toHeader)) {
        anomalies.push('Invalid To header format');
        isCompliant = false;
      }
    }

    // Check Call-ID format
    if (metadata.callId || metadata['Call-ID']) {
      const callId = metadata.callId || metadata['Call-ID'];
      if (!this.isValidCallID(callId)) {
        anomalies.push('Invalid Call-ID format');
        isCompliant = false;
      }
    }

    // Check Via header
    if (metadata.via || metadata.Via) {
      const via = metadata.via || metadata.Via;
      if (!this.isValidViaHeader(via)) {
        anomalies.push('Invalid Via header format');
        isCompliant = false;
      }
    }

    return isCompliant;
  }

  /**
   * Validate SIP address format
   */
  private isValidSIPAddress(address: string): boolean {
    // SIP address format: "Display Name" <sip:user@domain>
    const sipRegex = /^(?:"?([^"]*)"?\s*)?<?sip:([^@]+)@([^>]+)>?/i;
    return sipRegex.test(address);
  }

  /**
   * Validate Call-ID format
   */
  private isValidCallID(callId: string): boolean {
    // Call-ID should be unique identifier
    return callId.length > 0 && callId.length < 255;
  }

  /**
   * Validate Via header
   */
  private isValidViaHeader(via: string | string[]): boolean {
    if (Array.isArray(via)) {
      return via.every(v => this.isValidSingleVia(v));
    }
    return this.isValidSingleVia(via);
  }

  /**
   * Validate single Via header entry
   */
  private isValidSingleVia(via: string): boolean {
    // Via format: SIP/2.0/UDP host:port;branch=xxx
    const viaRegex = /^SIP\/2\.0\/(UDP|TCP|TLS|SCTP)\s+[\w\.\-]+(?::\d+)?/i;
    return viaRegex.test(via);
  }

  /**
   * Detect caller ID spoofing
   */
  private detectCallerIDSpoofing(metadata: CallMetadata, indicators: string[]): void {
    const fromHeader = metadata.fromHeader || metadata.From;
    const contact = metadata.contact || metadata.Contact;

    if (!fromHeader) return;

    // Extract caller ID from From header
    const fromMatch = fromHeader.match(/sip:([^@]+)@/i);
    const fromNumber = fromMatch ? fromMatch[1] : null;

    // Check for common spoofing patterns
    if (fromNumber) {
      // Sequential or repeated digits (e.g., 1111111111, 1234567890)
      if (/^(\d)\1{9,}$/.test(fromNumber)) {
        indicators.push('Caller ID contains repeated digits');
      }
      
      if (/^(0123456789|1234567890)$/.test(fromNumber)) {
        indicators.push('Caller ID is sequential pattern');
      }

      // Invalid area codes (000, 911, etc.)
      if (/^(000|911|555)/.test(fromNumber)) {
        indicators.push('Caller ID has invalid area code');
      }

      // International prefixes with local format mismatch
      if (fromNumber.startsWith('+') && fromNumber.length < 10) {
        indicators.push('Caller ID format inconsistent');
      }
    }

    // Check From vs Contact mismatch
    if (contact) {
      const contactMatch = contact.match(/sip:([^@]+)@/i);
      const contactNumber = contactMatch ? contactMatch[1] : null;

      if (fromNumber && contactNumber && fromNumber !== contactNumber) {
        const fromNormalized = fromNumber.replace(/\D/g, '');
        const contactNormalized = contactNumber.replace(/\D/g, '');

        if (fromNormalized !== contactNormalized) {
          indicators.push('From and Contact headers mismatch');
        }
      }
    }

    // Check for privacy headers indicating intentional hiding
    if (metadata.Privacy === 'id' || metadata.privacy === 'id') {
      indicators.push('Privacy header indicates caller hiding identity');
    }

    // Check P-Asserted-Identity vs From mismatch
    if (metadata['P-Asserted-Identity']) {
      const paiMatch = metadata['P-Asserted-Identity'].match(/sip:([^@]+)@/i);
      const paiNumber = paiMatch ? paiMatch[1] : null;

      if (fromNumber && paiNumber && fromNumber !== paiNumber) {
        indicators.push('P-Asserted-Identity differs from From header');
      }
    }
  }

  /**
   * Detect Via header manipulation
   */
  private detectViaManipulation(metadata: CallMetadata, anomalies: string[]): void {
    const via = metadata.via || metadata.Via;

    if (!via) return;

    const viaArray = Array.isArray(via) ? via : [via];

    // Check for too many Via headers (indicates long proxy chain)
    if (viaArray.length > 5) {
      anomalies.push(`Excessive Via headers: ${viaArray.length} (possible relay attack)`);
    }

    // Check for branch parameter consistency
    for (const v of viaArray) {
      if (!v.includes('branch=')) {
        anomalies.push('Via header missing required branch parameter');
      } else {
        // Branch should start with z9hG4bK (magic cookie)
        const branchMatch = v.match(/branch=([^;]+)/);
        if (branchMatch && !branchMatch[1].startsWith('z9hG4bK')) {
          anomalies.push('Via branch parameter missing RFC 3261 magic cookie');
        }
      }
    }

    // Check for private IP addresses in Via (shouldn't be in public SIP)
    for (const v of viaArray) {
      const ipMatch = v.match(/\b(\d{1,3}\.){3}\d{1,3}\b/);
      if (ipMatch) {
        const ip = ipMatch[0];
        if (this.isPrivateIP(ip)) {
          anomalies.push(`Via header contains private IP: ${ip}`);
        }
      }
    }
  }

  /**
   * Check if IP is private/internal
   */
  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    
    // 127.0.0.0/8
    if (parts[0] === 127) return true;

    return false;
  }

  /**
   * Check User-Agent for suspicious values
   */
  private checkUserAgent(
    metadata: CallMetadata,
    spoofingIndicators: string[],
    anomalies: string[]
  ): void {
    const userAgent = metadata.userAgent || metadata['User-Agent'];

    if (!userAgent) {
      anomalies.push('Missing User-Agent header');
      return;
    }

    // Check against known scanning tools
    const lowerUA = userAgent.toLowerCase();
    for (const suspicious of this.suspiciousUserAgents) {
      if (lowerUA.includes(suspicious)) {
        spoofingIndicators.push(`Suspicious User-Agent detected: ${suspicious}`);
      }
    }

    // Check for generic/fake User-Agent
    if (userAgent === 'User-Agent' || userAgent === 'SIP' || userAgent.length < 3) {
      spoofingIndicators.push('Generic or fake User-Agent');
    }

    // Check for empty or whitespace-only
    if (userAgent.trim().length === 0) {
      anomalies.push('Empty User-Agent header');
    }
  }

  /**
   * Validate From and To headers
   */
  private validateFromToHeaders(metadata: CallMetadata, anomalies: string[]): void {
    const from = metadata.fromHeader || metadata.From;
    const to = metadata.toHeader || metadata.To;

    if (from && to) {
      // Extract domains
      const fromDomain = this.extractDomain(from);
      const toDomain = this.extractDomain(to);

      // Check for suspicious TLDs
      const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz'];
      
      if (fromDomain && suspiciousTLDs.some(tld => fromDomain.endsWith(tld))) {
        anomalies.push(`From header uses suspicious TLD: ${fromDomain}`);
      }

      // Check for localhost or internal domains
      if (fromDomain === 'localhost' || fromDomain === '127.0.0.1') {
        anomalies.push('From header uses localhost domain');
      }
    }
  }

  /**
   * Extract domain from SIP address
   */
  private extractDomain(sipAddress: string): string | null {
    const match = sipAddress.match(/@([^>;]+)/);
    return match ? match[1] : null;
  }

  /**
   * Check for timestamp anomalies
   */
  private checkTimestampAnomalies(metadata: CallMetadata, anomalies: string[]): void {
    if (metadata.timestamp) {
      const now = new Date();
      const callTime = new Date(metadata.timestamp);

      // Check for future timestamps
      if (callTime > now) {
        const diffMinutes = (callTime.getTime() - now.getTime()) / 60000;
        if (diffMinutes > 5) {
          anomalies.push(`Call timestamp is ${Math.round(diffMinutes)} minutes in the future`);
        }
      }

      // Check for very old timestamps
      const ageHours = (now.getTime() - callTime.getTime()) / 3600000;
      if (ageHours > 24) {
        anomalies.push(`Call timestamp is ${Math.round(ageHours)} hours old`);
      }
    }

    // Check Date header if present
    if (metadata.Date || metadata.date) {
      const dateHeader = new Date(metadata.Date || metadata.date);
      const now = new Date();

      if (Math.abs(dateHeader.getTime() - now.getTime()) > 300000) { // 5 minutes
        anomalies.push('Date header significantly differs from current time');
      }
    }
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(
    anomalyCount: number,
    spoofingCount: number,
    headerCompleteness: number,
    protocolCompliance: boolean
  ): number {
    let risk = 0;

    // Base risk from anomalies
    risk += Math.min(anomalyCount * 0.1, 0.4);

    // Spoofing indicators
    risk += Math.min(spoofingCount * 0.15, 0.5);

    // Missing headers penalty
    risk += (1 - headerCompleteness) * 0.2;

    // Protocol non-compliance
    if (!protocolCompliance) {
      risk += 0.2;
    }

    return Math.min(risk, 0.95);
  }

  /**
   * Development mode mock
   */
  private mockMetadataAnalysis(): SIPHeaderAnalysis {
    const scenarios: SIPHeaderAnalysis[] = [
      {
        hasAnomalies: true,
        anomalies: [
          'Missing required header: CSeq',
          'Invalid From header format',
          'Via header contains private IP: 192.168.1.1',
          'Excessive Via headers: 7 (possible relay attack)'
        ],
        spoofingIndicators: [
          'Caller ID contains repeated digits',
          'From and Contact headers mismatch',
          'Suspicious User-Agent detected: sipvicious'
        ],
        headerCompleteness: 0.6,
        protocolCompliance: false,
        riskScore: 0.88
      },
      {
        hasAnomalies: true,
        anomalies: [
          'Missing User-Agent header',
          'Via header missing required branch parameter'
        ],
        spoofingIndicators: [
          'Caller ID has invalid area code'
        ],
        headerCompleteness: 0.8,
        protocolCompliance: true,
        riskScore: 0.45
      },
      {
        hasAnomalies: false,
        anomalies: [],
        spoofingIndicators: [],
        headerCompleteness: 1.0,
        protocolCompliance: true,
        riskScore: 0.05
      },
      {
        hasAnomalies: true,
        anomalies: [
          'From header uses suspicious TLD: caller.tk',
          'Call timestamp is 12 minutes in the future'
        ],
        spoofingIndicators: [
          'Privacy header indicates caller hiding identity',
          'Generic or fake User-Agent'
        ],
        headerCompleteness: 0.9,
        protocolCompliance: true,
        riskScore: 0.62
      }
    ];

    return scenarios[Math.floor(Math.random() * scenarios.length)] ?? scenarios[2]!;
  }
}

export default CallMetadataAnalyzer;
