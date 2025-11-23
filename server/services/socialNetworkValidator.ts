/**
 * Social Network Validation
 * Cross-reference callers with social media and business platforms
 * to verify legitimacy and online presence
 */

import { db } from "@db";
import { phoneNumbers } from "@db/schema";
import { eq } from "drizzle-orm";
import { logger } from '../utils/logger';

interface SocialPlatformResult {
  found: boolean;
  verified: boolean;
  profileUrl?: string;
  businessName?: string;
  employeeCount?: number;
  establishedDate?: Date;
}

interface SocialValidationResult {
  hasOnlinePresence: boolean;
  platforms: string[];
  businessVerified: boolean;
  riskScore: number;
  details: {
    linkedin?: SocialPlatformResult;
    facebook?: SocialPlatformResult;
    twitter?: SocialPlatformResult;
    googleBusiness?: SocialPlatformResult;
    instagram?: SocialPlatformResult;
  };
  confidence: number;
}

export class SocialNetworkValidator {
  private developmentMode: boolean;
  private apiKeys: Map<string, string>;

  constructor(developmentMode = false) {
    this.developmentMode = developmentMode;
    this.apiKeys = new Map();
    
    // Load API keys from environment
    this.apiKeys.set('linkedin', process.env.LINKEDIN_API_KEY || '');
    this.apiKeys.set('facebook', process.env.FACEBOOK_API_KEY || '');
    this.apiKeys.set('twitter', process.env.TWITTER_API_KEY || '');
    this.apiKeys.set('google', process.env.GOOGLE_BUSINESS_API_KEY || '');
  }

  /**
   * Validate caller across multiple social platforms
   */
  async validateCaller(phoneNumber: string, callerName?: string): Promise<SocialValidationResult> {
    if (this.developmentMode) {
      return this.mockSocialValidation(phoneNumber, callerName);
    }

    try {
      // Search across all platforms in parallel
      const [linkedin, facebook, twitter, googleBusiness, instagram] = await Promise.all([
        this.checkLinkedIn(phoneNumber, callerName),
        this.checkFacebook(phoneNumber, callerName),
        this.checkTwitter(callerName),
        this.checkGoogleBusiness(phoneNumber, callerName),
        this.checkInstagram(phoneNumber, callerName)
      ]);

      const details = { linkedin, facebook, twitter, googleBusiness, instagram };
      
      // Calculate overall metrics
      const platforms = Object.entries(details)
        .filter(([_, result]) => result.found)
        .map(([platform, _]) => platform);
      
      const hasOnlinePresence = platforms.length > 0;
      const businessVerified = googleBusiness.verified || linkedin.verified;
      
      // Risk scoring
      let riskScore = this.calculateSocialRiskScore(details, platforms.length);
      
      // Confidence scoring
      const confidence = this.calculateConfidence(details, platforms.length);

      return {
        hasOnlinePresence,
        platforms,
        businessVerified,
        riskScore,
        details,
        confidence
      };
    } catch (error) {
      logger.error('Social validation failed', error as Error, 'SocialNetworkValidator', { phoneNumber });
      return {
        hasOnlinePresence: false,
        platforms: [],
        businessVerified: false,
        riskScore: 0.5, // Unknown = medium risk
        details: {},
        confidence: 0
      };
    }
  }

  /**
   * Check LinkedIn for business presence
   */
  private async checkLinkedIn(phoneNumber: string, callerName?: string): Promise<SocialPlatformResult> {
    try {
      const apiKey = this.apiKeys.get('linkedin');
      if (!apiKey) {
        return { found: false, verified: false };
      }

      // Search by phone number first
      let response = await fetch(`https://api.linkedin.com/v2/organizations?q=phone&phone=${encodeURIComponent(phoneNumber)}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      // If not found by phone, try by name
      if (!response.ok && callerName) {
        response = await fetch(`https://api.linkedin.com/v2/organizations?q=name&name=${encodeURIComponent(callerName)}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
      }

      if (!response.ok) {
        return { found: false, verified: false };
      }

      const data = await response.json();
      
      if (data.elements && data.elements.length > 0) {
        const org = data.elements[0];
        return {
          found: true,
          verified: org.verified || false,
          profileUrl: org.vanityName ? `https://linkedin.com/company/${org.vanityName}` : undefined,
          businessName: org.localizedName,
          employeeCount: org.staffCount,
          establishedDate: org.foundedOn ? new Date(org.foundedOn.year, org.foundedOn.month || 0) : undefined
        };
      }

      return { found: false, verified: false };
    } catch (error) {
      logger.error('LinkedIn check error:', error as Error, 'LinkedIn check error:'.split(' ')[0]);
      return { found: false, verified: false };
    }
  }

  /**
   * Check Facebook Business Pages
   */
  private async checkFacebook(phoneNumber: string, callerName?: string): Promise<SocialPlatformResult> {
    try {
      const apiKey = this.apiKeys.get('facebook');
      if (!apiKey) {
        return { found: false, verified: false };
      }

      const searchQuery = callerName || phoneNumber;
      const response = await fetch(
        `https://graph.facebook.com/v12.0/pages/search?q=${encodeURIComponent(searchQuery)}&access_token=${apiKey}`
      );

      if (!response.ok) {
        return { found: false, verified: false };
      }

      const data = await response.json();

      if (data.data && data.data.length > 0) {
        const page = data.data[0];
        
        // Verify phone number matches if available
        const phoneMatches = page.phone && page.phone.includes(phoneNumber.replace(/\D/g, '').slice(-10));
        
        return {
          found: true,
          verified: page.is_verified || phoneMatches,
          profileUrl: `https://facebook.com/${page.id}`,
          businessName: page.name
        };
      }

      return { found: false, verified: false };
    } catch (error) {
      logger.error('Facebook check error:', error as Error, 'Facebook check error:'.split(' ')[0]);
      return { found: false, verified: false };
    }
  }

  /**
   * Check Twitter/X for business presence
   */
  private async checkTwitter(callerName?: string): Promise<SocialPlatformResult> {
    if (!callerName) {
      return { found: false, verified: false };
    }

    try {
      const apiKey = this.apiKeys.get('twitter');
      if (!apiKey) {
        return { found: false, verified: false };
      }

      const response = await fetch(
        `https://api.twitter.com/2/users/by/username/${encodeURIComponent(callerName.replace(/\s+/g, ''))}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );

      if (!response.ok) {
        return { found: false, verified: false };
      }

      const data = await response.json();

      if (data.data) {
        return {
          found: true,
          verified: data.data.verified || false,
          profileUrl: `https://twitter.com/${data.data.username}`,
          businessName: data.data.name
        };
      }

      return { found: false, verified: false };
    } catch (error) {
      logger.error('Twitter check error:', error as Error, 'Twitter check error:'.split(' ')[0]);
      return { found: false, verified: false };
    }
  }

  /**
   * Check Google Business Profile
   */
  private async checkGoogleBusiness(phoneNumber: string, callerName?: string): Promise<SocialPlatformResult> {
    try {
      const apiKey = this.apiKeys.get('google');
      if (!apiKey) {
        return { found: false, verified: false };
      }

      const searchQuery = callerName || phoneNumber;
      const response = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/locations:search?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: searchQuery,
            pageSize: 5
          })
        }
      );

      if (!response.ok) {
        return { found: false, verified: false };
      }

      const data = await response.json();

      if (data.locations && data.locations.length > 0) {
        const location = data.locations[0];
        
        // Check if phone number matches
        const phoneMatches = location.phoneNumbers?.primaryPhone === phoneNumber;
        
        return {
          found: true,
          verified: location.metadata?.verified || phoneMatches,
          profileUrl: location.metadata?.mapsUrl,
          businessName: location.title
        };
      }

      return { found: false, verified: false };
    } catch (error) {
      logger.error('Google Business check error:', error as Error, 'Google Business check error:'.split(' ')[0]);
      return { found: false, verified: false };
    }
  }

  /**
   * Check Instagram Business profiles
   */
  private async checkInstagram(phoneNumber: string, callerName?: string): Promise<SocialPlatformResult> {
    if (!callerName) {
      return { found: false, verified: false };
    }

    try {
      const apiKey = this.apiKeys.get('facebook'); // Instagram uses Facebook Graph API
      if (!apiKey) {
        return { found: false, verified: false };
      }

      const username = callerName.replace(/\s+/g, '').toLowerCase();
      const response = await fetch(
        `https://graph.facebook.com/v12.0/ig_user?username=${encodeURIComponent(username)}&access_token=${apiKey}`
      );

      if (!response.ok) {
        return { found: false, verified: false };
      }

      const data = await response.json();

      if (data.id) {
        return {
          found: true,
          verified: data.is_verified || false,
          profileUrl: `https://instagram.com/${username}`,
          businessName: data.name
        };
      }

      return { found: false, verified: false };
    } catch (error) {
      logger.error('Instagram check error:', error as Error, 'Instagram check error:'.split(' ')[0]);
      return { found: false, verified: false };
    }
  }

  /**
   * Calculate risk score based on social presence
   */
  private calculateSocialRiskScore(details: any, platformCount: number): number {
    let riskScore = 0.8; // Start with high risk

    // Reduce risk for each platform found
    riskScore -= platformCount * 0.15;

    // Major risk reduction for verified business
    if (details.googleBusiness?.verified) {
      riskScore -= 0.3;
    }

    if (details.linkedin?.verified) {
      riskScore -= 0.25;
    }

    // Slight reduction for verified social media
    if (details.facebook?.verified || details.twitter?.verified) {
      riskScore -= 0.1;
    }

    // Bonus for established businesses
    if (details.linkedin?.establishedDate) {
      const yearsOld = (Date.now() - details.linkedin.establishedDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (yearsOld > 5) {
        riskScore -= 0.15;
      }
    }

    return Math.max(0, Math.min(1, riskScore));
  }

  /**
   * Calculate confidence in the validation
   */
  private calculateConfidence(details: any, platformCount: number): number {
    if (platformCount === 0) {
      return 0.3; // Low confidence when no presence found
    }

    let confidence = 0.5; // Base confidence

    // Increase for multiple platforms
    confidence += platformCount * 0.1;

    // Increase for verified platforms
    if (details.googleBusiness?.verified) confidence += 0.2;
    if (details.linkedin?.verified) confidence += 0.15;
    if (details.facebook?.verified) confidence += 0.1;

    // Increase for business information
    if (details.linkedin?.employeeCount) confidence += 0.05;
    if (details.linkedin?.establishedDate) confidence += 0.05;

    return Math.min(1, confidence);
  }

  /**
   * Development mode mock
   */
  private mockSocialValidation(phoneNumber: string, callerName?: string): SocialValidationResult {
    const hash = phoneNumber.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const scenario = hash % 5;

    switch (scenario) {
      case 0: // Verified business with strong online presence
        return {
          hasOnlinePresence: true,
          platforms: ['linkedin', 'facebook', 'googleBusiness', 'twitter'],
          businessVerified: true,
          riskScore: 0.1,
          details: {
            linkedin: {
              found: true,
              verified: true,
              profileUrl: 'https://linkedin.com/company/acme-corp',
              businessName: 'Acme Corporation',
              employeeCount: 500,
              establishedDate: new Date('2010-01-01')
            },
            googleBusiness: {
              found: true,
              verified: true,
              profileUrl: 'https://maps.google.com/acme',
              businessName: 'Acme Corporation'
            },
            facebook: {
              found: true,
              verified: true,
              businessName: 'Acme Corporation'
            },
            twitter: {
              found: true,
              verified: true,
              businessName: 'Acme Corp'
            }
          },
          confidence: 0.95
        };

      case 1: // Some presence, partially verified
        return {
          hasOnlinePresence: true,
          platforms: ['facebook', 'googleBusiness'],
          businessVerified: true,
          riskScore: 0.3,
          details: {
            googleBusiness: {
              found: true,
              verified: true,
              businessName: 'Local Business Inc'
            },
            facebook: {
              found: true,
              verified: false,
              businessName: 'Local Business'
            }
          },
          confidence: 0.7
        };

      case 2: // Minimal presence, not verified
        return {
          hasOnlinePresence: true,
          platforms: ['facebook'],
          businessVerified: false,
          riskScore: 0.6,
          details: {
            facebook: {
              found: true,
              verified: false,
              businessName: callerName || 'Unknown Business'
            }
          },
          confidence: 0.4
        };

      default: // No online presence (suspicious)
        return {
          hasOnlinePresence: false,
          platforms: [],
          businessVerified: false,
          riskScore: 0.85,
          details: {},
          confidence: 0.3
        };
    }
  }
}

export default SocialNetworkValidator;
