/**
 * STIR/SHAKEN Call Authentication
 * Verifies calls using industry-standard cryptographic signatures
 * Prevents caller ID spoofing through PKI-based verification
 */

import crypto from 'crypto';

interface PASSporTHeader {
  alg: string; // Algorithm (ES256)
  ppt: string; // PASSporT type
  typ: string; // Type (passport)
  x5u: string; // Certificate URL
}

interface PASSporTPayload {
  attest: 'A' | 'B' | 'C'; // Attestation level
  dest: { tn: string[] }; // Destination numbers
  iat: number; // Issued at timestamp
  orig: { tn: string }; // Originating number
  origid: string; // Origination ID
}

interface STIRSHAKENResult {
  verified: boolean;
  attestationLevel: 'A' | 'B' | 'C' | 'none';
  signatureValid: boolean;
  reason: string;
  certificateValid?: boolean;
  riskScore: number;
}

export class STIRSHAKENVerification {
  private developmentMode: boolean;
  private trustedCAs: Set<string>;

  constructor(developmentMode = false) {
    this.developmentMode = developmentMode;
    this.trustedCAs = new Set([
      // Add trusted Certificate Authority URLs
      'https://certificate-authority.example.com',
    ]);
  }

  /**
   * Verify call authenticity using STIR/SHAKEN
   */
  async verifyCallAuthenticity(
    callerId: string,
    sipHeaders: any
  ): Promise<STIRSHAKENResult> {
    if (this.developmentMode) {
      return this.mockSTIRSHAKEN(callerId);
    }

    try {
      // Extract PASSporT token from SIP Identity header
      const passport = this.extractPassport(sipHeaders);

      if (!passport) {
        return {
          verified: false,
          attestationLevel: 'none',
          signatureValid: false,
          reason: 'No STIR/SHAKEN authentication present',
          riskScore: 0.9
        };
      }

      // Decode and parse PASSporT
      const { header, payload, signature } = this.decodePassport(passport);

      // Verify signature
      const signatureValid = await this.verifySignature(header, payload, signature);

      if (!signatureValid) {
        return {
          verified: false,
          attestationLevel: payload.attest || 'none',
          signatureValid: false,
          reason: 'Invalid cryptographic signature',
          riskScore: 0.95
        };
      }

      // Verify certificate
      const certificateValid = await this.verifyCertificate(header.x5u);

      // Check attestation level
      const attestation = payload.attest;
      const riskScore = this.calculateRiskScore(attestation, signatureValid, certificateValid);

      return {
        verified: true,
        attestationLevel: attestation,
        signatureValid,
        certificateValid,
        reason: this.getAttestationDescription(attestation),
        riskScore
      };
    } catch (error) {
      console.error('STIR/SHAKEN verification error:', error);
      return {
        verified: false,
        attestationLevel: 'none',
        signatureValid: false,
        reason: 'Verification failed',
        riskScore: 0.8
      };
    }
  }

  /**
   * Extract PASSporT token from SIP Identity header
   */
  private extractPassport(sipHeaders: any): string | null {
    if (!sipHeaders || !sipHeaders.Identity) {
      return null;
    }

    // SIP Identity header format:
    // Identity: <PASSporT>;info=<certificate-url>;alg=ES256;ppt=shaken
    const identityHeader = sipHeaders.Identity;
    const passportMatch = identityHeader.match(/<([^>]+)>/);

    return passportMatch ? passportMatch[1] : null;
  }

  /**
   * Decode PASSporT JWT token
   */
  private decodePassport(passport: string): {
    header: PASSporTHeader;
    payload: PASSporTPayload;
    signature: string;
  } {
    const parts = passport.split('.');
    
    if (parts.length !== 3) {
      throw new Error('Invalid PASSporT format');
    }

    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const signature = parts[2];

    return { header, payload, signature };
  }

  /**
   * Verify cryptographic signature
   */
  private async verifySignature(
    header: PASSporTHeader,
    payload: PASSporTPayload,
    signature: string
  ): Promise<boolean> {
    try {
      // Get public key from certificate URL
      const publicKey = await this.fetchPublicKey(header.x5u);

      // Verify signature using ES256 (ECDSA with SHA-256)
      const data = Buffer.from(
        `${Buffer.from(JSON.stringify(header)).toString('base64')}.${Buffer.from(JSON.stringify(payload)).toString('base64')}`
      );
      
      const verify = crypto.createVerify('SHA256');
      verify.update(data);
      
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Fetch public key from certificate URL
   */
  private async fetchPublicKey(certUrl: string): Promise<string> {
    try {
      const response = await fetch(certUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch certificate');
      }

      const cert = await response.text();
      return cert; // Return PEM-formatted certificate
    } catch (error) {
      console.error('Certificate fetch error:', error);
      throw error;
    }
  }

  /**
   * Verify certificate is from trusted CA
   */
  private async verifyCertificate(certUrl: string): Promise<boolean> {
    try {
      // Check if cert URL is from trusted CA
      const url = new URL(certUrl);
      const isTrusted = this.trustedCAs.has(url.origin);

      // Additional certificate validation could be done here:
      // - Check expiration
      // - Verify certificate chain
      // - Check revocation status (OCSP)

      return isTrusted;
    } catch (error) {
      console.error('Certificate verification error:', error);
      return false;
    }
  }

  /**
   * Calculate risk score based on attestation and verification
   */
  private calculateRiskScore(
    attestation: 'A' | 'B' | 'C' | 'none',
    signatureValid: boolean,
    certificateValid: boolean = true
  ): number {
    if (!signatureValid || !certificateValid) {
      return 0.95;
    }

    switch (attestation) {
      case 'A': // Full attestation - carrier knows caller
        return 0.05;
      case 'B': // Partial - carrier authenticated call origin
        return 0.25;
      case 'C': // Gateway - call came through gateway
        return 0.45;
      default:
        return 0.9;
    }
  }

  /**
   * Get attestation level description
   */
  private getAttestationDescription(level: 'A' | 'B' | 'C' | 'none'): string {
    switch (level) {
      case 'A':
        return 'Full attestation: Carrier fully authenticated caller identity';
      case 'B':
        return 'Partial attestation: Carrier authenticated call origination';
      case 'C':
        return 'Gateway attestation: Call verified to have entered network through known gateway';
      default:
        return 'No attestation available';
    }
  }

  /**
   * Development mode mock
   */
  private mockSTIRSHAKEN(callerId: string): STIRSHAKENResult {
    const hash = callerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const scenario = hash % 4;

    const attestations: Array<'A' | 'B' | 'C' | 'none'> = ['A', 'B', 'C', 'none'];
    const level = attestations[scenario];

    return {
      verified: level !== 'none',
      attestationLevel: level,
      signatureValid: level !== 'none',
      certificateValid: level === 'A' || level === 'B',
      reason: this.getAttestationDescription(level),
      riskScore: this.calculateRiskScore(level, level !== 'none', true)
    };
  }
}

export default STIRSHAKENVerification;
