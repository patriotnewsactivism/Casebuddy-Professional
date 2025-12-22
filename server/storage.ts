import { 
  type User, 
  type InsertUser, 
  type Case,
  type InsertCase,
  type DiscoveryFile,
  type InsertDiscoveryFile,
  type TimelineEvent,
  type InsertTimelineEvent,
  type DepositionPrep,
  type InsertDepositionPrep,
  type SuggestedFiling,
  type InsertSuggestedFiling,
  type CloudFolder,
  type InsertCloudFolder,
  type LegalBrief,
  type InsertLegalBrief,
  type CallRecording,
  type InsertCallRecording,
  type TrialPrepSession,
  type InsertTrialPrepSession,
  users,
  cases,
  discoveryFiles,
  timelineEvents,
  depositionPrep,
  suggestedFilings,
  cloudFolders,
  legalBriefs,
  callRecordings,
  trialPrepSessions,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Cases
  getCase(id: number): Promise<Case | undefined>;
  getAllCases(): Promise<Case[]>;
  createCase(data: InsertCase): Promise<Case>;
  updateCase(id: number, data: Partial<InsertCase>): Promise<Case | undefined>;
  deleteCase(id: number): Promise<void>;
  
  // Discovery Files
  getDiscoveryFile(id: number): Promise<DiscoveryFile | undefined>;
  getDiscoveryFilesByCase(caseId: number): Promise<DiscoveryFile[]>;
  createDiscoveryFile(data: InsertDiscoveryFile): Promise<DiscoveryFile>;
  updateDiscoveryFile(id: number, data: Partial<InsertDiscoveryFile>): Promise<DiscoveryFile | undefined>;
  deleteDiscoveryFile(id: number): Promise<void>;
  
  // Timeline Events
  getTimelineEventsByCase(caseId: number): Promise<TimelineEvent[]>;
  createTimelineEvent(data: InsertTimelineEvent): Promise<TimelineEvent>;
  deleteTimelineEvent(id: number): Promise<void>;
  
  // Deposition Prep
  getDepositionPrepByCase(caseId: number): Promise<DepositionPrep[]>;
  createDepositionPrep(data: InsertDepositionPrep): Promise<DepositionPrep>;
  updateDepositionPrep(id: number, data: Partial<InsertDepositionPrep>): Promise<DepositionPrep | undefined>;
  deleteDepositionPrep(id: number): Promise<void>;
  
  // Suggested Filings
  getSuggestedFilingsByCase(caseId: number): Promise<SuggestedFiling[]>;
  createSuggestedFiling(data: InsertSuggestedFiling): Promise<SuggestedFiling>;
  updateSuggestedFiling(id: number, data: Partial<InsertSuggestedFiling>): Promise<SuggestedFiling | undefined>;
  deleteSuggestedFiling(id: number): Promise<void>;
  
  // Cloud Folders
  getCloudFoldersByCase(caseId: number): Promise<CloudFolder[]>;
  getCloudFolder(id: number): Promise<CloudFolder | undefined>;
  createCloudFolder(data: InsertCloudFolder): Promise<CloudFolder>;
  updateCloudFolder(id: number, data: Partial<InsertCloudFolder>): Promise<CloudFolder | undefined>;
  deleteCloudFolder(id: number): Promise<void>;
  getDiscoveryFileByCloudId(cloudFileId: string): Promise<DiscoveryFile | undefined>;
  
  // Legal Briefs
  getLegalBriefsByCase(caseId: number): Promise<LegalBrief[]>;
  getLegalBrief(id: number): Promise<LegalBrief | undefined>;
  createLegalBrief(data: InsertLegalBrief): Promise<LegalBrief>;
  updateLegalBrief(id: number, data: Partial<InsertLegalBrief>): Promise<LegalBrief | undefined>;
  deleteLegalBrief(id: number): Promise<void>;
  
  // Call Recordings
  getCallRecordingsByCase(caseId: number): Promise<CallRecording[]>;
  createCallRecording(data: InsertCallRecording): Promise<CallRecording>;
  updateCallRecording(id: number, data: Partial<InsertCallRecording>): Promise<CallRecording | undefined>;
  
  // Trial Prep Sessions
  getTrialPrepSessionsByCase(caseId: number): Promise<TrialPrepSession[]>;
  getTrialPrepSession(id: number): Promise<TrialPrepSession | undefined>;
  createTrialPrepSession(data: InsertTrialPrepSession): Promise<TrialPrepSession>;
  updateTrialPrepSession(id: number, data: Partial<InsertTrialPrepSession>): Promise<TrialPrepSession | undefined>;
  deleteTrialPrepSession(id: number): Promise<void>;
}

class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Cases
  async getCase(id: number): Promise<Case | undefined> {
    const [caseRecord] = await db.select().from(cases).where(eq(cases.id, id));
    return caseRecord;
  }

  async getAllCases(): Promise<Case[]> {
    return db.select().from(cases).orderBy(desc(cases.updatedAt));
  }

  async createCase(data: InsertCase): Promise<Case> {
    const [caseRecord] = await db.insert(cases).values(data).returning();
    return caseRecord;
  }

  async updateCase(id: number, data: Partial<InsertCase>): Promise<Case | undefined> {
    const [updated] = await db
      .update(cases)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cases.id, id))
      .returning();
    return updated;
  }

  async deleteCase(id: number): Promise<void> {
    await db.delete(cases).where(eq(cases.id, id));
  }

  // Discovery Files
  async getDiscoveryFile(id: number): Promise<DiscoveryFile | undefined> {
    const [file] = await db.select().from(discoveryFiles).where(eq(discoveryFiles.id, id));
    return file;
  }

  async getDiscoveryFilesByCase(caseId: number): Promise<DiscoveryFile[]> {
    return db.select().from(discoveryFiles).where(eq(discoveryFiles.caseId, caseId)).orderBy(discoveryFiles.batesStart);
  }

  async createDiscoveryFile(data: InsertDiscoveryFile): Promise<DiscoveryFile> {
    const [file] = await db.insert(discoveryFiles).values(data).returning();
    return file;
  }

  async updateDiscoveryFile(id: number, data: Partial<InsertDiscoveryFile>): Promise<DiscoveryFile | undefined> {
    const [updated] = await db
      .update(discoveryFiles)
      .set(data)
      .where(eq(discoveryFiles.id, id))
      .returning();
    return updated;
  }

  async deleteDiscoveryFile(id: number): Promise<void> {
    await db.delete(discoveryFiles).where(eq(discoveryFiles.id, id));
  }

  // Timeline Events
  async getTimelineEventsByCase(caseId: number): Promise<TimelineEvent[]> {
    return db.select().from(timelineEvents).where(eq(timelineEvents.caseId, caseId)).orderBy(timelineEvents.eventDate);
  }

  async createTimelineEvent(data: InsertTimelineEvent): Promise<TimelineEvent> {
    const [event] = await db.insert(timelineEvents).values(data).returning();
    return event;
  }

  async deleteTimelineEvent(id: number): Promise<void> {
    await db.delete(timelineEvents).where(eq(timelineEvents.id, id));
  }

  // Deposition Prep
  async getDepositionPrepByCase(caseId: number): Promise<DepositionPrep[]> {
    return db.select().from(depositionPrep).where(eq(depositionPrep.caseId, caseId)).orderBy(desc(depositionPrep.createdAt));
  }

  async createDepositionPrep(data: InsertDepositionPrep): Promise<DepositionPrep> {
    const [prep] = await db.insert(depositionPrep).values(data).returning();
    return prep;
  }

  async updateDepositionPrep(id: number, data: Partial<InsertDepositionPrep>): Promise<DepositionPrep | undefined> {
    const [updated] = await db
      .update(depositionPrep)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(depositionPrep.id, id))
      .returning();
    return updated;
  }

  async deleteDepositionPrep(id: number): Promise<void> {
    await db.delete(depositionPrep).where(eq(depositionPrep.id, id));
  }

  // Suggested Filings
  async getSuggestedFilingsByCase(caseId: number): Promise<SuggestedFiling[]> {
    return db.select().from(suggestedFilings).where(eq(suggestedFilings.caseId, caseId)).orderBy(desc(suggestedFilings.createdAt));
  }

  async createSuggestedFiling(data: InsertSuggestedFiling): Promise<SuggestedFiling> {
    const [filing] = await db.insert(suggestedFilings).values(data).returning();
    return filing;
  }

  async updateSuggestedFiling(id: number, data: Partial<InsertSuggestedFiling>): Promise<SuggestedFiling | undefined> {
    const [updated] = await db
      .update(suggestedFilings)
      .set(data)
      .where(eq(suggestedFilings.id, id))
      .returning();
    return updated;
  }

  async deleteSuggestedFiling(id: number): Promise<void> {
    await db.delete(suggestedFilings).where(eq(suggestedFilings.id, id));
  }

  // Cloud Folders
  async getCloudFoldersByCase(caseId: number): Promise<CloudFolder[]> {
    return db.select().from(cloudFolders).where(eq(cloudFolders.caseId, caseId)).orderBy(desc(cloudFolders.createdAt));
  }

  async getCloudFolder(id: number): Promise<CloudFolder | undefined> {
    const [folder] = await db.select().from(cloudFolders).where(eq(cloudFolders.id, id));
    return folder;
  }

  async createCloudFolder(data: InsertCloudFolder): Promise<CloudFolder> {
    const [folder] = await db.insert(cloudFolders).values(data).returning();
    return folder;
  }

  async updateCloudFolder(id: number, data: Partial<InsertCloudFolder>): Promise<CloudFolder | undefined> {
    const [updated] = await db
      .update(cloudFolders)
      .set({ ...data, lastSynced: new Date() })
      .where(eq(cloudFolders.id, id))
      .returning();
    return updated;
  }

  async deleteCloudFolder(id: number): Promise<void> {
    await db.delete(cloudFolders).where(eq(cloudFolders.id, id));
  }

  async getDiscoveryFileByCloudId(cloudFileId: string): Promise<DiscoveryFile | undefined> {
    const [file] = await db.select().from(discoveryFiles).where(eq(discoveryFiles.cloudFileId, cloudFileId));
    return file;
  }

  // Legal Briefs
  async getLegalBriefsByCase(caseId: number): Promise<LegalBrief[]> {
    return db.select().from(legalBriefs).where(eq(legalBriefs.caseId, caseId)).orderBy(desc(legalBriefs.createdAt));
  }

  async getLegalBrief(id: number): Promise<LegalBrief | undefined> {
    const [brief] = await db.select().from(legalBriefs).where(eq(legalBriefs.id, id));
    return brief;
  }

  async createLegalBrief(data: InsertLegalBrief): Promise<LegalBrief> {
    const [brief] = await db.insert(legalBriefs).values(data).returning();
    return brief;
  }

  async updateLegalBrief(id: number, data: Partial<InsertLegalBrief>): Promise<LegalBrief | undefined> {
    const [updated] = await db
      .update(legalBriefs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(legalBriefs.id, id))
      .returning();
    return updated;
  }

  async deleteLegalBrief(id: number): Promise<void> {
    await db.delete(legalBriefs).where(eq(legalBriefs.id, id));
  }

  // Call Recordings
  async getCallRecordingsByCase(caseId: number): Promise<CallRecording[]> {
    return db.select().from(callRecordings).where(eq(callRecordings.caseId, caseId)).orderBy(desc(callRecordings.createdAt));
  }

  async createCallRecording(data: InsertCallRecording): Promise<CallRecording> {
    const [recording] = await db.insert(callRecordings).values(data).returning();
    return recording;
  }

  async updateCallRecording(id: number, data: Partial<InsertCallRecording>): Promise<CallRecording | undefined> {
    const [updated] = await db
      .update(callRecordings)
      .set(data)
      .where(eq(callRecordings.id, id))
      .returning();
    return updated;
  }

  // Trial Prep Sessions
  async getTrialPrepSessionsByCase(caseId: number): Promise<TrialPrepSession[]> {
    return db.select().from(trialPrepSessions).where(eq(trialPrepSessions.caseId, caseId)).orderBy(desc(trialPrepSessions.createdAt));
  }

  async getTrialPrepSession(id: number): Promise<TrialPrepSession | undefined> {
    const [session] = await db.select().from(trialPrepSessions).where(eq(trialPrepSessions.id, id));
    return session;
  }

  async createTrialPrepSession(data: InsertTrialPrepSession): Promise<TrialPrepSession> {
    const [session] = await db.insert(trialPrepSessions).values(data).returning();
    return session;
  }

  async updateTrialPrepSession(id: number, data: Partial<InsertTrialPrepSession>): Promise<TrialPrepSession | undefined> {
    const [updated] = await db
      .update(trialPrepSessions)
      .set(data)
      .where(eq(trialPrepSessions.id, id))
      .returning();
    return updated;
  }

  async deleteTrialPrepSession(id: number): Promise<void> {
    await db.delete(trialPrepSessions).where(eq(trialPrepSessions.id, id));
  }
}

export const storage = new DatabaseStorage();
