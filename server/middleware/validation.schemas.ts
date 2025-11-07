import { z } from "zod";

/**
 * Validation schemas for API request bodies
 * Using Zod for type-safe runtime validation
 */

// Auth schemas
export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  role: z.enum(['admin', 'user']).optional().default('user'),
  email: z.string().email("Invalid email address").optional(),
});

// Phone number schemas
export const phoneNumberSchema = z.object({
  number: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number must be at most 15 digits"),
  type: z.enum(['blacklist', 'whitelist']),
  description: z.string().max(500).optional(),
});

export const phoneNumberParamSchema = z.object({
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
});

// Call screening schemas
export const screenCallSchema = z.object({
  data: z.string().min(1, "Encrypted data is required"),
});

export const deviceHeartbeatSchema = z.object({
  data: z.string().min(1, "Heartbeat data is required"),
  timestamp: z.string().datetime().optional(),
});

// Device registration schemas
export const deviceRegistrationSchema = z.object({
  deviceId: z.string().min(1).max(100),
  deviceName: z.string().min(1).max(200),
  deviceType: z.string().min(1).max(100),
  modemModel: z.string().max(200).optional(),
  firmwareVersion: z.string().max(50).optional(),
});

// Spam report schemas
export const spamReportSchema = z.object({
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  category: z.enum(['telemarketing', 'scam', 'robocall', 'survey', 'other']),
  description: z.string().max(1000).optional(),
  audioSampleUrl: z.string().url().optional(),
});

// Voice analysis schemas
export const voiceAnalysisSchema = z.object({
  audioData: z.string().min(1, "Audio data is required"),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  sampleRate: z.number().int().min(8000).max(48000).optional().default(8000),
});

// Settings schemas
export const updateSettingSchema = z.object({
  featureKey: z.string().min(1).max(100),
  isEnabled: z.boolean(),
  configuration: z.record(z.any()).optional(),
});

// Date range schemas
export const dateRangeSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
});

// Verification schemas
export const verificationRequestSchema = z.object({
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  code: z.string().length(6, "Verification code must be 6 digits").regex(/^\d{6}$/, "Code must contain only digits"),
});

// GitHub schemas
export const githubRepoSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, "Repository name can only contain letters, numbers, hyphens, and underscores"),
  description: z.string().max(500).optional(),
  isPrivate: z.boolean().optional().default(false),
});

// Query parameter schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive("ID must be a positive number"),
});

export const deviceIdParamSchema = z.object({
  deviceId: z.string().min(1).max(100),
});

// Risk score query schema
export const riskScoreQuerySchema = z.object({
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  includeFactors: z.coerce.boolean().optional().default(false),
});

// Bulk operation schemas
export const bulkPhoneNumberSchema = z.object({
  numbers: z.array(
    z.object({
      number: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
      type: z.enum(['blacklist', 'whitelist']),
      description: z.string().max(500).optional(),
    })
  ).min(1, "At least one phone number is required").max(100, "Maximum 100 numbers per request"),
});

// Export type inference helpers
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type PhoneNumberInput = z.infer<typeof phoneNumberSchema>;
export type SpamReportInput = z.infer<typeof spamReportSchema>;
export type VoiceAnalysisInput = z.infer<typeof voiceAnalysisSchema>;
export type DeviceRegistrationInput = z.infer<typeof deviceRegistrationSchema>;
export type RiskScoreQuery = z.infer<typeof riskScoreQuerySchema>;
