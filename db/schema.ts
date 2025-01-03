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
  callerIdInfo: jsonb("caller_id_info"), // Store caller ID information
  blockingRules: jsonb("blocking_rules"), // Store custom blocking rules
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
  callerId: jsonb("caller_id").notNull(), // Store structured caller ID data
  carrierInfo: jsonb("carrier_info"), // Store carrier information
  lineType: text("line_type"), // mobile, landline, voip, etc.
  timeOfDay: integer("time_of_day"), // Hour of day (0-23) for pattern analysis
  dayOfWeek: integer("day_of_week"), // Day of week (0-6) for pattern analysis
  deviceId: text("device_id"), // Reference to the device that processed this call
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
  reporterScore: decimal("reporter_score", { precision: 5, scale: 2 }), // Reputation score for reporter
  audioSampleUrl: text("audio_sample_url"), // URL to stored audio sample
  location: jsonb("location"), // Reporter's location for geographic analysis
});

export const callPatterns = pgTable("call_patterns", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  patternType: text("pattern_type").notNull(), // sequential, time-based, geographic
  patternData: jsonb("pattern_data").notNull(), // Store pattern details
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  active: boolean("active").default(true),
});

export const geoRules = pgTable("geo_rules", {
  id: serial("id").primaryKey(),
  region: text("region").notNull(), // Country code or region identifier
  riskLevel: decimal("risk_level", { precision: 5, scale: 2 }).notNull(),
  blockingEnabled: boolean("blocking_enabled").default(false),
  rules: jsonb("rules").notNull(), // Specific rules for the region
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const featureSettings = pgTable("feature_settings", {
  id: serial("id").primaryKey(),
  featureKey: text("feature_key").notNull().unique(),
  isEnabled: boolean("is_enabled").default(true),
  configuration: jsonb("configuration"), // Store feature-specific settings
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deviceConfigurations = pgTable("device_configurations", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull().unique(),
  name: text("name").notNull(),
  ipAddress: text("ip_address").notNull(),
  port: integer("port").notNull(),
  deviceType: text("device_type").notNull(), // e.g., 'raspberry_pi', 'android', 'custom'
  status: text("status").default('offline').notNull(),
  lastHeartbeat: timestamp("last_heartbeat"),
  authToken: text("auth_token").notNull(),
  settings: jsonb("settings"), // Store device-specific settings
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
export const insertCallPatternSchema = createInsertSchema(callPatterns);
export const selectCallPatternSchema = createSelectSchema(callPatterns);
export const insertGeoRuleSchema = createInsertSchema(geoRules);
export const selectGeoRuleSchema = createSelectSchema(geoRules);
export const insertFeatureSettingSchema = createInsertSchema(featureSettings);
export const selectFeatureSettingSchema = createSelectSchema(featureSettings);
export const insertDeviceConfigurationSchema = createInsertSchema(deviceConfigurations);
export const selectDeviceConfigurationSchema = createSelectSchema(deviceConfigurations);

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
export type CallPattern = typeof callPatterns.$inferSelect;
export type InsertCallPattern = typeof callPatterns.$inferInsert;
export type GeoRule = typeof geoRules.$inferSelect;
export type InsertGeoRule = typeof geoRules.$inferInsert;
export type FeatureSetting = typeof featureSettings.$inferSelect;
export type InsertFeatureSetting = typeof featureSettings.$inferInsert;
export type DeviceConfiguration = typeof deviceConfigurations.$inferSelect;
export type InsertDeviceConfiguration = typeof deviceConfigurations.$inferInsert;