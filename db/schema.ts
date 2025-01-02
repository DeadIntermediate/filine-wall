import { pgTable, text, serial, timestamp, boolean, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const phoneNumbers = pgTable("phone_numbers", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  type: text("type").notNull(), // blacklist or whitelist
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  active: boolean("active").default(true),
  dncStatus: jsonb("dnc_status"), // Store DNC registry information
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

// Schemas for validation
export const insertPhoneNumberSchema = createInsertSchema(phoneNumbers);
export const selectPhoneNumberSchema = createSelectSchema(phoneNumbers);
export const insertCallLogSchema = createInsertSchema(callLogs);
export const selectCallLogSchema = createSelectSchema(callLogs);

// Types
export type PhoneNumber = typeof phoneNumbers.$inferSelect;
export type InsertPhoneNumber = typeof phoneNumbers.$inferInsert;
export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = typeof callLogs.$inferInsert;