import { mysqlTable, text, int, timestamp, boolean, json, decimal } from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// User Management Tables
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default('user'), // 'admin' or 'user'
  email: text("email").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
  active: boolean("active").default(true),
  preferences: json("preferences"),
});

export const sessions = mysqlTable("sessions", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  lastActivity: timestamp("last_activity"),
  deviceInfo: json("device_info"),
});

export const accessControl = mysqlTable("access_control", {
  id: int("id").primaryKey().autoincrement(),
  role: text("role").notNull(),
  resource: text("resource").notNull(),
  permissions: json("permissions").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const phoneNumbers = mysqlTable("phone_numbers", {
  id: int("id").primaryKey().autoincrement(),
  number: text("number").notNull().unique(), // Added unique constraint
  type: text("type").notNull(), // blacklist or whitelist
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  active: boolean("active").default(true),
  dncStatus: json("dnc_status"), // Store DNC registry information
  reputationScore: decimal("reputation_score", { precision: 5, scale: 2 }).default('50'),
  lastScoreUpdate: timestamp("last_score_update").defaultNow(),
  scoreFactors: json("score_factors"), // Store detailed scoring factors
  callerIdInfo: json("caller_id_info"), // Store caller ID information
  blockingRules: json("blocking_rules"), // Store custom blocking rules
});

export const callLogs = mysqlTable("call_logs", {
  id: int("id").primaryKey().autoincrement(),
  phoneNumber: text("phone_number").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  action: text("action").notNull(), // blocked, allowed
  duration: text("duration"),
  metadata: json("metadata"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  callerId: json("caller_id").notNull(), // Store structured caller ID data
  carrierInfo: json("carrier_info"), // Store carrier information
  lineType: text("line_type"), // mobile, landline, voip, etc.
  timeOfDay: int("time_of_day"), // Hour of day (0-23) for pattern analysis
  dayOfWeek: int("day_of_week"), // Day of week (0-6) for pattern analysis
  deviceId: text("device_id"), // Reference to the device that processed this call
});

export const spamReports = mysqlTable("spam_reports", {
  id: int("id").primaryKey().autoincrement(),
  phoneNumber: text("phone_number").notNull(),
  reportedAt: timestamp("reported_at").defaultNow().notNull(),
  category: text("category").notNull(), // e.g., 'telemarketing', 'scam', 'robocall'
  description: text("description"),
  status: text("status").default('pending').notNull(), // pending, verified, rejected
  confirmations: int("confirmations").default(1).notNull(),
  metadata: json("metadata"), // Additional report details
  reporterScore: decimal("reporter_score", { precision: 5, scale: 2 }), // Reputation score for reporter
  audioSampleUrl: text("audio_sample_url"), // URL to stored audio sample
  location: json("location"), // Reporter's location for geographic analysis
});

export const callPatterns = mysqlTable("call_patterns", {
  id: int("id").primaryKey().autoincrement(),
  phoneNumber: text("phone_number").notNull(),
  patternType: text("pattern_type").notNull(), // sequential, time-based, geographic
  patternData: json("pattern_data").notNull(), // Store pattern details
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  active: boolean("active").default(true),
});

export const geoRules = mysqlTable("geo_rules", {
  id: int("id").primaryKey().autoincrement(),
  region: text("region").notNull(), // Country code or region identifier
  riskLevel: decimal("risk_level", { precision: 5, scale: 2 }).notNull(),
  blockingEnabled: boolean("blocking_enabled").default(false),
  rules: json("rules").notNull(), // Specific rules for the region
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verificationCodes = mysqlTable("verification_codes", {
  id: int("id").primaryKey().autoincrement(),
  phoneNumber: text("phone_number").notNull(),
  code: text("code").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  verifiedAt: timestamp("verified_at"),
  metadata: json("metadata"), // Store additional verification details
});

export const voicePatterns = mysqlTable("voice_patterns", {
  id: int("id").primaryKey().autoincrement(),
  patternType: text("pattern_type").notNull(), // 'robot', 'spam', 'legitimate'
  features: json("features").notNull(), // Store normalized feature vectors
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
  language: text("language"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadata: json("metadata"), // Additional pattern information
  active: boolean("active").default(true),
});

export const featureSettings = mysqlTable("feature_settings", {
  id: int("id").primaryKey().autoincrement(),
  featureKey: text("feature_key").notNull().unique(),
  isEnabled: boolean("is_enabled").default(true),
  configuration: json("configuration"), // Store feature-specific settings
  displayOrder: int("display_order"), // For ordering dashboard components
  category: text("category"), // For grouping features (e.g., 'dashboard', 'security')
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deviceConfigurations = mysqlTable("device_configurations", {
  id: int("id").primaryKey().autoincrement(),
  deviceId: text("device_id").notNull().unique(),
  name: text("name").notNull(),
  ipAddress: text("ip_address"), // Optional for USB devices
  port: int("port"), // Optional for USB devices
  devicePath: text("device_path"), // USB device path (e.g., /dev/ttyUSB0)
  deviceType: text("device_type").notNull(), // e.g., 'raspberry_pi', 'android', 'usb_modem', 'custom'
  connectionType: text("connection_type").default('network').notNull(), // 'network' or 'usb'
  status: text("status").default('offline').notNull(),
  lastHeartbeat: timestamp("last_heartbeat"),
  authToken: text("auth_token").notNull(),
  settings: json("settings"), // Store device-specific settings
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deviceRegistrations = mysqlTable("device_registrations", {
  id: int("id").primaryKey().autoincrement(),
  deviceId: text("device_id").notNull().unique(),
  name: text("name").notNull(),
  deviceType: text("device_type").notNull(),
  publicKey: text("public_key").notNull(),
  authToken: text("auth_token").notNull(),
  encryptionKey: text("encryption_key").notNull(),
  status: text("status").notNull().default('pending'),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
  lastActive: timestamp("last_active"),
  metadata: json("metadata"),
});

export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").primaryKey().autoincrement(),
  userId: text("user_id").notNull(),
  quietHoursStart: int("quiet_hours_start"),
  quietHoursEnd: int("quiet_hours_end"),
  riskThreshold: decimal("risk_threshold", { precision: 5, scale: 2 }).default('0.7'),
  blockCategories: json("block_categories"), // Array of categories to block
  allowKnownCallers: boolean("allow_known_callers").default(true),
  blockInternational: boolean("block_international").default(false),
  blockUnknown: boolean("block_unknown").default(false),
  blockWithoutCallerId: boolean("block_without_caller_id").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const blockingRules = mysqlTable("blocking_rules", {
  id: int("id").primaryKey().autoincrement(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  ruleType: text("rule_type").notNull(), // time, category, location, pattern
  isEnabled: boolean("is_enabled").default(true),
  priority: int("priority").default(0),
  conditions: json("conditions").notNull(), // Time ranges, categories, etc.
  action: text("action").notNull(), // block, allow, challenge
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
export const insertUserPreferencesSchema = createInsertSchema(userPreferences);
export const selectUserPreferencesSchema = createSelectSchema(userPreferences);
export const insertBlockingRuleSchema = createInsertSchema(blockingRules);
export const selectBlockingRuleSchema = createSelectSchema(blockingRules);
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertSessionSchema = createInsertSchema(sessions);
export const selectSessionSchema = createSelectSchema(sessions);
export const insertAccessControlSchema = createInsertSchema(accessControl);
export const selectAccessControlSchema = createSelectSchema(accessControl);

export const insertDeviceRegistrationSchema = createInsertSchema(deviceRegistrations);
export const selectDeviceRegistrationSchema = createSelectSchema(deviceRegistrations);
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
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;
export type BlockingRule = typeof blockingRules.$inferSelect;
export type InsertBlockingRule = typeof blockingRules.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;
export type AccessControl = typeof accessControl.$inferSelect;
export type InsertAccessControl = typeof accessControl.$inferInsert;
export type DeviceRegistration = typeof deviceRegistrations.$inferSelect;
export type InsertDeviceRegistration = typeof deviceRegistrations.$inferInsert;