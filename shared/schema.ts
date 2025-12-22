import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Cases
export const cases = pgTable("cases", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  caseNumber: varchar("case_number", { length: 100 }).notNull().unique(),
  client: text("client").notNull(),
  status: text("status").notNull().default("active"),
  description: text("description"),
  nextDeadline: timestamp("next_deadline"),
  // Representation context - who we represent and what we're looking for
  representationType: varchar("representation_type", { length: 20 }).default("plaintiff"), // plaintiff, defendant, petitioner, respondent
  opposingParty: text("opposing_party"),
  caseTheory: text("case_theory"), // Our theory of the case - what we're trying to prove
  keyIssues: text("key_issues").array(), // Key legal issues to focus on
  winningFactors: text("winning_factors"), // What evidence would help win this case
  trappingFactors: text("trapping_factors"), // What inconsistencies to look for in opposing side
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Discovery Files
export const discoveryFiles = pgTable("discovery_files", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  batesStart: varchar("bates_start", { length: 50 }).notNull(),
  batesEnd: varchar("bates_end", { length: 50 }).notNull(),
  fileName: text("file_name").notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull(),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  uploadDate: timestamp("upload_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  processedDate: timestamp("processed_date"),
  relevance: varchar("relevance", { length: 20 }).default("medium"),
  tags: text("tags").array(),
  summary: text("summary"),
  extractedText: text("extracted_text"),
  extractedDates: jsonb("extracted_dates"),
  metadata: jsonb("metadata"),
  // Strategic analysis fields
  favorableFindings: text("favorable_findings").array(),
  adverseFindings: text("adverse_findings").array(),
  inconsistencies: text("inconsistencies").array(),
  actionItems: text("action_items").array(),
  // Cloud storage fields
  sourceType: varchar("source_type", { length: 20 }).default("upload"),
  cloudFileId: text("cloud_file_id"),
  cloudProvider: varchar("cloud_provider", { length: 20 }),
  driveUrl: text("drive_url"),
});

// Cloud Folders (for syncing)
export const cloudFolders = pgTable("cloud_folders", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 20 }).notNull(),
  folderId: text("folder_id").notNull(),
  folderName: text("folder_name").notNull(),
  lastSynced: timestamp("last_synced"),
  batesPrefix: varchar("bates_prefix", { length: 20 }).notNull(),
  nextBatesNumber: integer("next_bates_number").default(1).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Timeline Events
export const timelineEvents = pgTable("timeline_events", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  eventDate: timestamp("event_date").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  linkedBates: text("linked_bates").array(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Deposition Prep
export const depositionPrep = pgTable("deposition_prep", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  depositionType: varchar("deposition_type", { length: 50 }).notNull(),
  targetWitness: text("target_witness"),
  questions: jsonb("questions").notNull(),
  strategy: text("strategy"),
  linkedEvidence: text("linked_evidence").array(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// AI Chat Conversations (for AI Insights)
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").references(() => cases.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Suggested Filings
export const suggestedFilings = pgTable("suggested_filings", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  filingType: text("filing_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  deadline: timestamp("deadline"),
  priority: varchar("priority", { length: 20 }).default("medium"),
  status: varchar("status", { length: 20 }).default("pending"),
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
export const insertCaseSchema = createInsertSchema(cases).omit({ id: true, createdAt: true, updatedAt: true });
// Simplified schema for case intake modal (only requires the basics)
export const caseIntakeSchema = z.object({
  title: z.string().min(1, "Title is required"),
  caseNumber: z.string().min(1, "Case number is required"),
  client: z.string().min(1, "Client name is required"),
  description: z.string().optional(),
  representationType: z.enum(["plaintiff", "defendant", "petitioner", "respondent"]).optional(),
  opposingParty: z.string().optional(),
  caseTheory: z.string().optional(),
  winningFactors: z.string().optional(),
  trappingFactors: z.string().optional(),
});
export const insertDiscoveryFileSchema = createInsertSchema(discoveryFiles).omit({ id: true, uploadDate: true, processedDate: true });
export const insertTimelineEventSchema = createInsertSchema(timelineEvents).omit({ id: true, createdAt: true });
export const insertDepositionPrepSchema = createInsertSchema(depositionPrep).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertSuggestedFilingSchema = createInsertSchema(suggestedFilings).omit({ id: true, createdAt: true });
export const insertCloudFolderSchema = createInsertSchema(cloudFolders).omit({ id: true, createdAt: true, lastSynced: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Case = typeof cases.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type CaseIntake = z.infer<typeof caseIntakeSchema>;
export type DiscoveryFile = typeof discoveryFiles.$inferSelect;
export type InsertDiscoveryFile = z.infer<typeof insertDiscoveryFileSchema>;
export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type InsertTimelineEvent = z.infer<typeof insertTimelineEventSchema>;
export type DepositionPrep = typeof depositionPrep.$inferSelect;
export type InsertDepositionPrep = z.infer<typeof insertDepositionPrepSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type SuggestedFiling = typeof suggestedFilings.$inferSelect;
export type InsertSuggestedFiling = z.infer<typeof insertSuggestedFilingSchema>;
export type CloudFolder = typeof cloudFolders.$inferSelect;
export type InsertCloudFolder = z.infer<typeof insertCloudFolderSchema>;

// Legal Briefs
export const legalBriefs = pgTable("legal_briefs", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  briefType: varchar("brief_type", { length: 50 }).notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  precedents: jsonb("precedents"),
  keyArguments: jsonb("key_arguments"),
  status: varchar("status", { length: 20 }).default("draft"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertLegalBriefSchema = createInsertSchema(legalBriefs).omit({ id: true, createdAt: true, updatedAt: true });
export type LegalBrief = typeof legalBriefs.$inferSelect;
export type InsertLegalBrief = z.infer<typeof insertLegalBriefSchema>;

// News Articles (cached from external sources)
export const newsArticles = pgTable("news_articles", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary"),
  imageUrl: text("image_url"),
  publishedAt: timestamp("published_at"),
  featured: boolean("featured").default(false),
  source: varchar("source", { length: 100 }).default("wtpnews"),
  fetchedAt: timestamp("fetched_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type NewsArticle = typeof newsArticles.$inferSelect;
export type InsertNewsArticle = typeof newsArticles.$inferInsert;

// Call Recordings and Transcripts
export const callRecordings = pgTable("call_recordings", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  roomName: text("room_name").notNull(),
  recordingId: text("recording_id"),
  recordingUrl: text("recording_url"),
  transcriptId: text("transcript_id"),
  transcriptUrl: text("transcript_url"),
  transcriptText: text("transcript_text"),
  duration: integer("duration"), // seconds
  participants: jsonb("participants"),
  status: varchar("status", { length: 20 }).default("recording"), // recording, processing, completed, failed
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCallRecordingSchema = createInsertSchema(callRecordings).omit({ id: true, createdAt: true });
export type CallRecording = typeof callRecordings.$inferSelect;
export type InsertCallRecording = z.infer<typeof insertCallRecordingSchema>;

// Trial Prep Sessions
export const trialPrepSessions = pgTable("trial_prep_sessions", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  sessionMode: varchar("session_mode", { length: 50 }).notNull(),
  transcript: jsonb("transcript").notNull(),
  allTips: text("all_tips").array(),
  allWarnings: text("all_warnings").array(),
  allSuggestedResponses: text("all_suggested_responses").array(),
  notes: text("notes"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTrialPrepSessionSchema = createInsertSchema(trialPrepSessions).omit({ id: true, createdAt: true });
export type TrialPrepSession = typeof trialPrepSessions.$inferSelect;
export type InsertTrialPrepSession = z.infer<typeof insertTrialPrepSessionSchema>;
