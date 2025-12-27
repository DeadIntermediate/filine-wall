import { EncryptionService } from '../services/encryptionService';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    encryptionService = new EncryptionService('test-key-for-testing');
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const originalText = 'Hello, World!';
      const encrypted = encryptionService.encrypt(originalText);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(originalText);
      expect(encrypted).not.toBe(originalText);
    });

    it('should produce different encrypted outputs for the same input', () => {
      const originalText = 'Same input';
      const encrypted1 = encryptionService.encrypt(originalText);
      const encrypted2 = encryptionService.encrypt(originalText);

      expect(encrypted1).not.toBe(encrypted2);
      expect(encryptionService.decrypt(encrypted1)).toBe(originalText);
      expect(encryptionService.decrypt(encrypted2)).toBe(originalText);
    });
  });

  describe('encryptJSON/decryptJSON', () => {
    it('should encrypt and decrypt JSON objects correctly', () => {
      const originalData = { name: 'John', age: 30, active: true };
      const encrypted = encryptionService.encryptJSON(originalData);
      const decrypted = encryptionService.decryptJSON(encrypted);

      expect(decrypted).toEqual(originalData);
    });
  });

  describe('hash/compareHash', () => {
    it('should hash a value and compare correctly', () => {
      const value = 'password123';
      const hash = encryptionService.hash(value);

      expect(encryptionService.compareHash(value, hash)).toBe(true);
      expect(encryptionService.compareHash('wrongpassword', hash)).toBe(false);
    });

    it('should produce consistent hashes', () => {
      const value = 'consistent';
      const hash1 = encryptionService.hash(value);
      const hash2 = encryptionService.hash(value);

      expect(hash1).toBe(hash2);
    });
  });

  describe('generateToken', () => {
    it('should generate random tokens', () => {
      const token1 = encryptionService.generateToken();
      const token2 = encryptionService.generateToken();

      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes * 2 hex chars
      expect(token2.length).toBe(64);
    });
  });
});