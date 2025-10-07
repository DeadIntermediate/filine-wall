import { db } from "@db";
import { phoneNumbers } from "@db/schema";
import { eq } from "drizzle-orm";

interface IVRChallenge {
  phoneNumber: string;
  challenge: string;
  expectedResponse: string;
  expiresAt: Date;
  attempts: number;
}

class IVRChallengeService {
  private activeChallenges = new Map<string, IVRChallenge>();
  private readonly MAX_ATTEMPTS = 3;
  private readonly CHALLENGE_TIMEOUT = 30000; // 30 seconds

  /**
   * Generate an IVR challenge for a phone number
   */
  generateChallenge(phoneNumber: string): IVRChallenge {
    // Simple numeric challenge: "Press 1 to continue"
    const challenge = "press_1";
    const expectedResponse = "1";

    const ivrChallenge: IVRChallenge = {
      phoneNumber,
      challenge,
      expectedResponse,
      expiresAt: new Date(Date.now() + this.CHALLENGE_TIMEOUT),
      attempts: 0
    };

    this.activeChallenges.set(phoneNumber, ivrChallenge);

    // Auto-cleanup after timeout
    setTimeout(() => {
      this.activeChallenges.delete(phoneNumber);
    }, this.CHALLENGE_TIMEOUT);

    return ivrChallenge;
  }

  /**
   * Verify the response to an IVR challenge
   */
  async verifyResponse(phoneNumber: string, response: string): Promise<{
    success: boolean;
    message: string;
    remainingAttempts?: number;
  }> {
    const challenge = this.activeChallenges.get(phoneNumber);

    if (!challenge) {
      return {
        success: false,
        message: "No active challenge found or challenge expired"
      };
    }

    if (new Date() > challenge.expiresAt) {
      this.activeChallenges.delete(phoneNumber);
      return {
        success: false,
        message: "Challenge expired"
      };
    }

    challenge.attempts++;

    if (response === challenge.expectedResponse) {
      // Success - whitelist the number temporarily
      await this.whitelistNumber(phoneNumber);
      this.activeChallenges.delete(phoneNumber);
      
      return {
        success: true,
        message: "Challenge passed successfully"
      };
    }

    const remainingAttempts = this.MAX_ATTEMPTS - challenge.attempts;

    if (remainingAttempts <= 0) {
      // Failed all attempts - blacklist the number
      await this.blacklistNumber(phoneNumber);
      this.activeChallenges.delete(phoneNumber);
      
      return {
        success: false,
        message: "Maximum attempts exceeded. Number has been blocked."
      };
    }

    return {
      success: false,
      message: "Incorrect response",
      remainingAttempts
    };
  }

  /**
   * Get IVR prompt message for modem/device
   */
  getIVRPrompt(phoneNumber: string): string {
    const challenge = this.activeChallenges.get(phoneNumber);
    
    if (!challenge) {
      return "Thank you for calling. Goodbye.";
    }

    switch (challenge.challenge) {
      case "press_1":
        return "This call is being screened. To continue, please press 1 on your keypad.";
      default:
        return "This call is being screened. Please follow the instructions.";
    }
  }

  /**
   * Get DTMF audio command for playing IVR prompt
   */
  getModemCommand(phoneNumber: string): string[] {
    const prompt = this.getIVRPrompt(phoneNumber);
    
    // Return AT commands for the modem to play the prompt
    // This would need to be customized based on your specific modem model
    return [
      "ATA",  // Answer the call
      `AT+VTS="${prompt}"`,  // Play voice message (if supported)
      "AT+VTD=30"  // Wait for DTMF for 30 seconds
    ];
  }

  /**
   * Temporarily whitelist a number that passed the challenge
   */
  private async whitelistNumber(phoneNumber: string): Promise<void> {
    try {
      await db
        .insert(phoneNumbers)
        .values({
          number: phoneNumber,
          type: "whitelist",
          reputationScore: "80",
          description: "Passed IVR challenge verification",
          callerIdInfo: {
            source: "ivr_challenge",
            passedAt: new Date().toISOString(),
            temporary: true,
            expiresAt: new Date(Date.now() + 86400000).toISOString() // 24 hours
          }
        })
        .onConflictDoUpdate({
          target: phoneNumbers.number,
          set: {
            type: "whitelist",
            reputationScore: "80",
            description: "Passed IVR challenge verification",
            callerIdInfo: {
              source: "ivr_challenge",
              passedAt: new Date().toISOString(),
              temporary: true,
              expiresAt: new Date(Date.now() + 86400000).toISOString()
            }
          }
        });
      
      console.log(`Number ${phoneNumber} temporarily whitelisted after passing IVR challenge`);
    } catch (error) {
      console.error("Error whitelisting number:", error);
    }
  }

  /**
   * Blacklist a number that failed the challenge
   */
  private async blacklistNumber(phoneNumber: string): Promise<void> {
    try {
      await db
        .insert(phoneNumbers)
        .values({
          number: phoneNumber,
          type: "blacklist",
          reputationScore: "0",
          description: "Failed IVR verification challenge",
          callerIdInfo: {
            source: "ivr_challenge_failed",
            failedAt: new Date().toISOString(),
            reason: "Failed IVR verification challenge"
          }
        })
        .onConflictDoUpdate({
          target: phoneNumbers.number,
          set: {
            type: "blacklist",
            reputationScore: "0",
            description: "Failed IVR verification challenge",
            callerIdInfo: {
              source: "ivr_challenge_failed",
              failedAt: new Date().toISOString(),
              reason: "Failed IVR verification challenge"
            }
          }
        });
      
      console.log(`Number ${phoneNumber} blacklisted after failing IVR challenge`);
    } catch (error) {
      console.error("Error blacklisting number:", error);
    }
  }

  /**
   * Check if a number has an active challenge
   */
  hasActiveChallenge(phoneNumber: string): boolean {
    const challenge = this.activeChallenges.get(phoneNumber);
    return challenge !== undefined && new Date() <= challenge.expiresAt;
  }

  /**
   * Get challenge status
   */
  getChallengeStatus(phoneNumber: string): IVRChallenge | null {
    return this.activeChallenges.get(phoneNumber) || null;
  }

  /**
   * Clean up expired challenges (called periodically)
   */
  cleanupExpiredChallenges(): void {
    const now = new Date();
    const entries = Array.from(this.activeChallenges.entries());
    for (const [phoneNumber, challenge] of entries) {
      if (now > challenge.expiresAt) {
        this.activeChallenges.delete(phoneNumber);
      }
    }
  }
}

// Singleton instance
export const ivrService = new IVRChallengeService();

// Cleanup expired challenges every minute
setInterval(() => {
  ivrService.cleanupExpiredChallenges();
}, 60000);
