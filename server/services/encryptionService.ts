import crypto from 'crypto';

/**
 * Encryption service for securing sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

export class EncryptionService {
  private key: Buffer;

  constructor(masterKey?: string) {
    const keySource = masterKey || process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    
    if (keySource === 'default-key-change-in-production' && process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY must be set in production environment');
    }

    // Derive a proper encryption key from the master key
    const salt = crypto.randomBytes(SALT_LENGTH);
    this.key = crypto.scryptSync(keySource, salt, KEY_LENGTH);
  }

  /**
   * Encrypt a string value
   * @param plaintext - The text to encrypt
   * @returns Base64 encoded encrypted data with IV, salt, and auth tag
   */
  encrypt(plaintext: string): string {
    try {
      // Generate random salt and IV
      const salt = crypto.randomBytes(SALT_LENGTH);
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Derive key from master key and salt
      const key = crypto.scryptSync(
        process.env.ENCRYPTION_KEY || 'default-key-change-in-production',
        salt,
        KEY_LENGTH
      );

      // Create cipher and encrypt
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);

      // Get authentication tag
      const tag = cipher.getAuthTag();

      // Combine salt + iv + tag + encrypted data
      const result = Buffer.concat([salt, iv, tag, encrypted]);
      
      return result.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt an encrypted string
   * @param encryptedData - Base64 encoded encrypted data
   * @returns Decrypted plaintext
   */
  decrypt(encryptedData: string): string {
    try {
      const buffer = Buffer.from(encryptedData, 'base64');

      // Extract components
      const salt = buffer.subarray(0, SALT_LENGTH);
      const iv = buffer.subarray(SALT_LENGTH, TAG_POSITION);
      const tag = buffer.subarray(TAG_POSITION, ENCRYPTED_POSITION);
      const encrypted = buffer.subarray(ENCRYPTED_POSITION);

      // Derive key from master key and salt
      const key = crypto.scryptSync(
        process.env.ENCRYPTION_KEY || 'default-key-change-in-production',
        salt,
        KEY_LENGTH
      );

      // Create decipher and decrypt
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt JSON data
   * @param data - Object to encrypt
   * @returns Encrypted string
   */
  encryptJSON<T>(data: T): string {
    return this.encrypt(JSON.stringify(data));
  }

  /**
   * Decrypt JSON data
   * @param encryptedData - Encrypted string
   * @returns Decrypted object
   */
  decryptJSON<T>(encryptedData: string): T {
    const decrypted = this.decrypt(encryptedData);
    return JSON.parse(decrypted) as T;
  }

  /**
   * Hash a value (one-way, for passwords)
   * @param value - Value to hash
   * @returns Hex encoded hash
   */
  hash(value: string): string {
    return crypto
      .createHash('sha256')
      .update(value)
      .digest('hex');
  }

  /**
   * Compare a value with a hash
   * @param value - Plain value
   * @param hash - Hash to compare against
   * @returns True if they match
   */
  compareHash(value: string, hash: string): boolean {
    return this.hash(value) === hash;
  }

  /**
   * Generate a secure random token
   * @param length - Length in bytes (default 32)
   * @returns Hex encoded token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt data for device communication
   * Optimized for smaller payloads
   */
  encryptDeviceData(data: string): string {
    return this.encrypt(data);
  }

  /**
   * Decrypt data from device communication
   */
  decryptDeviceData(encryptedData: string): string {
    return this.decrypt(encryptedData);
  }
}

// Singleton instance
let encryptionInstance: EncryptionService | null = null;

/**
 * Get the encryption service instance
 */
export function getEncryptionService(): EncryptionService {
  if (!encryptionInstance) {
    encryptionInstance = new EncryptionService();
  }
  return encryptionInstance;
}

export default EncryptionService;
