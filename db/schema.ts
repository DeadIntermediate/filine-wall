import { pgTable, text, serial, timestamp, boolean, jsonb, decimal, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const phoneNumbers = pgTable("phone_numbers", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  type: text("type").notNull(), // blacklist or whitelist
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  active: boolean("active").default(true),
  dncStatus: jsonb("dnc_status"), // Store DNC registry information
  reputationScore: decimal("reputation_score", { precision: 5, scale: 2 }).default('50'),
  lastScoreUpdate: timestamp("last_score_update").defaultNow(),
  scoreFactors: jsonb("score_factors"), // Store detailed scoring factors
});

export const callLogs = pgTable("call_logs", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  action: text("action").notNull(), // blocked, allowed
  duration: text("duration"),
  metadata: jsonb("metadata"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
});

export const spamReports = pgTable("spam_reports", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  reportedAt: timestamp("reported_at").defaultNow().notNull(),
  category: text("category").notNull(), // e.g., 'telemarketing', 'scam', 'robocall'
  description: text("description"),
  status: text("status").default('pending').notNull(), // pending, verified, rejected
  confirmations: integer("confirmations").default(1).notNull(),
  metadata: jsonb("metadata"), // Additional report details
});

export const verificationCodes = pgTable("verification_codes", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  code: text("code").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  verifiedAt: timestamp("verified_at"),
  metadata: jsonb("metadata"), // Store additional verification details
});

export const voicePatterns = pgTable("voice_patterns", {
  id: serial("id").primaryKey(),
  patternType: text("pattern_type").notNull(), // 'robot', 'spam', 'legitimate'
  features: jsonb("features").notNull(), // Store normalized feature vectors
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
  language: text("language"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadata: jsonb("metadata"), // Additional pattern information
  active: boolean("active").default(true),
});

export const insertPhoneNumberSchema = createInsertSchema(phoneNumbers);
export const selectPhoneNumberSchema = createSelectSchema(phoneNumbers);
export const insertCallLogSchema = createInsertSchema(callLogs);
export const selectCallLogSchema = createSelectSchema(callLogs);
export const insertSpamReportSchema = createInsertSchema(spamReports);
export const selectSpamReportSchema = createSelectSchema(spamReports);
export const insertVerificationCodeSchema = createInsertSchema(verificationCodes);
export const selectVerificationCodeSchema = createSelectSchema(verificationCodes);
export const insertVoicePatternSchema = createInsertSchema(voicePatterns);
export const selectVoicePatternSchema = createSelectSchema(voicePatterns);

export type PhoneNumber = typeof phoneNumbers.$inferSelect;
export type InsertPhoneNumber = typeof phoneNumbers.$inferInsert;
export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = typeof callLogs.$inferInsert;
export type SpamReport = typeof spamReports.$inferSelect;
export type InsertSpamReport = typeof spamReports.$inferInsert;
export type VerificationCode = typeof verificationCodes.$inferSelect;
export type InsertVerificationCode = typeof verificationCodes.$inferInsert;
export type VoicePattern = typeof voicePatterns.$inferSelect;
export type InsertVoicePattern = typeof voicePatterns.$inferInsert;