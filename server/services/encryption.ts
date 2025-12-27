import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export class EncryptionService {
  private key: Buffer;

  constructor(masterKey: string) {
    // Derive encryption key from master key using PBKDF2
    this.key = crypto.scryptSync(masterKey, 'salt', KEY_LENGTH);
  }

  encrypt(plaintext: string): {
    encrypted: string;
    iv: string;
    authTag: string;
  } {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipherGCM(ALGORITHM, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encrypted: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipherGCM(ALGORITHM, this.key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  encryptObject(data: any): {
    encrypted: string;
    iv: string;
    authTag: string;
  } {
    return this.encrypt(JSON.stringify(data));
  }

  decryptObject(encrypted: string, iv: string, authTag: string): any {
    const decrypted = this.decrypt(encrypted, iv, authTag);
    return JSON.parse(decrypted);
  }
}