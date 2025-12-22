import { db } from "../db";
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * Audit Logging System for CaseBuddy Professional
 *
 * Provides comprehensive audit trail for legal compliance including:
 * - Authentication events (login, logout, password changes)
 * - Case access and modifications
 * - Document access and uploads
 * - Administrative actions
 *
 * Required for:
 * - ABA Model Rules compliance (technology competence)
 * - Client confidentiality protection
 * - Breach notification requirements
 * - eDiscovery preservation
 */

// Audit log table schema
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  userId: varchar("user_id", { length: 100 }),
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: varchar("resource_id", { length: 100 }),
  ip: varchar("ip", { length: 45 }),
  userAgent: text("user_agent"),
  details: jsonb("details"),
  success: varchar("success", { length: 10 }).default("true"),
});

// Audit action types
export enum AuditAction {
  // Authentication
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGOUT = "LOGOUT",
  PASSWORD_CHANGED = "PASSWORD_CHANGED",
  PASSWORD_CHANGE_FAILED = "PASSWORD_CHANGE_FAILED",
  USER_REGISTERED = "USER_REGISTERED",
  SESSION_EXPIRED = "SESSION_EXPIRED",

  // Case operations
  CASE_CREATED = "CASE_CREATED",
  CASE_VIEWED = "CASE_VIEWED",
  CASE_UPDATED = "CASE_UPDATED",
  CASE_DELETED = "CASE_DELETED",
  CASE_EXPORTED = "CASE_EXPORTED",

  // Discovery files
  FILE_UPLOADED = "FILE_UPLOADED",
  FILE_VIEWED = "FILE_VIEWED",
  FILE_DOWNLOADED = "FILE_DOWNLOADED",
  FILE_DELETED = "FILE_DELETED",
  FILE_ANALYZED = "FILE_ANALYZED",

  // Legal briefs
  BRIEF_CREATED = "BRIEF_CREATED",
  BRIEF_VIEWED = "BRIEF_VIEWED",
  BRIEF_UPDATED = "BRIEF_UPDATED",
  BRIEF_DELETED = "BRIEF_DELETED",

  // Deposition prep
  DEPOSITION_CREATED = "DEPOSITION_CREATED",
  DEPOSITION_VIEWED = "DEPOSITION_VIEWED",
  DEPOSITION_UPDATED = "DEPOSITION_UPDATED",

  // Timeline
  TIMELINE_GENERATED = "TIMELINE_GENERATED",
  TIMELINE_VIEWED = "TIMELINE_VIEWED",

  // Collaboration
  COLLABORATION_JOINED = "COLLABORATION_JOINED",
  COLLABORATION_LEFT = "COLLABORATION_LEFT",

  // Video calls
  VIDEO_CALL_STARTED = "VIDEO_CALL_STARTED",
  VIDEO_CALL_ENDED = "VIDEO_CALL_ENDED",
  RECORDING_SAVED = "RECORDING_SAVED",

  // Trial prep
  TRIAL_SIMULATION_STARTED = "TRIAL_SIMULATION_STARTED",
  TRIAL_SESSION_SAVED = "TRIAL_SESSION_SAVED",

  // AI operations
  AI_ANALYSIS_REQUESTED = "AI_ANALYSIS_REQUESTED",
  AI_DEPOSITION_GENERATED = "AI_DEPOSITION_GENERATED",
  AI_BRIEF_GENERATED = "AI_BRIEF_GENERATED",
  AI_TIMELINE_GENERATED = "AI_TIMELINE_GENERATED",

  // Cloud storage
  CLOUD_FOLDER_LINKED = "CLOUD_FOLDER_LINKED",
  CLOUD_FOLDER_SYNCED = "CLOUD_FOLDER_SYNCED",

  // Administrative
  ADMIN_ACTION = "ADMIN_ACTION",
  SECURITY_ALERT = "SECURITY_ALERT",
}

// Resource types for categorization
export enum ResourceType {
  USER = "user",
  CASE = "case",
  DISCOVERY_FILE = "discovery_file",
  LEGAL_BRIEF = "legal_brief",
  DEPOSITION = "deposition",
  TIMELINE = "timeline",
  VIDEO_CALL = "video_call",
  TRIAL_SESSION = "trial_session",
  CLOUD_FOLDER = "cloud_folder",
  SYSTEM = "system",
}

interface AuditLogEntry {
  action: AuditAction;
  userId: string | null;
  resourceType?: ResourceType;
  resourceId?: string | number;
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
  success?: boolean;
}

/**
 * Write an entry to the audit log
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      action: entry.action,
      userId: entry.userId,
      resourceType: entry.resourceType || null,
      resourceId: entry.resourceId?.toString() || null,
      ip: entry.ip || null,
      userAgent: entry.userAgent || null,
      details: entry.details || {},
      success: entry.success !== false ? "true" : "false",
    });
  } catch (error) {
    // Log to console but don't fail the operation
    console.error("Failed to write audit log:", error, entry);
  }
}

/**
 * Helper to extract IP and userAgent from request
 */
export function extractRequestInfo(req: any): { ip: string; userAgent: string } {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.ip
    || req.socket?.remoteAddress
    || "unknown";

  const userAgent = req.headers["user-agent"] || "unknown";

  return { ip, userAgent };
}

/**
 * Log case access
 */
export async function logCaseAccess(
  action: AuditAction,
  caseId: number,
  userId: string | null,
  ip: string,
  userAgent: string,
  details?: Record<string, any>
): Promise<void> {
  await auditLog({
    action,
    userId,
    resourceType: ResourceType.CASE,
    resourceId: caseId,
    ip,
    userAgent,
    details,
  });
}

/**
 * Log file access
 */
export async function logFileAccess(
  action: AuditAction,
  fileId: number,
  userId: string | null,
  ip: string,
  userAgent: string,
  details?: Record<string, any>
): Promise<void> {
  await auditLog({
    action,
    userId,
    resourceType: ResourceType.DISCOVERY_FILE,
    resourceId: fileId,
    ip,
    userAgent,
    details,
  });
}

/**
 * Log security alert
 */
export async function logSecurityAlert(
  message: string,
  ip: string,
  userAgent: string,
  details?: Record<string, any>
): Promise<void> {
  await auditLog({
    action: AuditAction.SECURITY_ALERT,
    userId: null,
    resourceType: ResourceType.SYSTEM,
    ip,
    userAgent,
    details: { message, ...details },
    success: false,
  });

  // Also log to console for immediate visibility
  console.warn(`[SECURITY ALERT] ${message}`, { ip, details });
}

// Ensure audit_logs table exists
export async function ensureAuditLogTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        action VARCHAR(50) NOT NULL,
        user_id VARCHAR(100),
        resource_type VARCHAR(50),
        resource_id VARCHAR(100),
        ip VARCHAR(45),
        user_agent TEXT,
        details JSONB,
        success VARCHAR(10) DEFAULT 'true'
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
    `);
  } catch (error) {
    console.error("Failed to create audit_logs table:", error);
  }
}
