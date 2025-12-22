import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { log } from "../index";
import { parse as parseCookie } from "cookie";
import { validateSession } from "../middleware/auth";
import { auditLog, AuditAction, ResourceType } from "./auditLog";

interface UserPresence {
  odId: string;
  odName: string;
  odColor: string;
  caseId: number;
  joinedAt: Date;
  lastActivity: Date;
  authenticated: boolean;
}

interface CollaborationMessage {
  type: "join" | "leave" | "presence" | "update" | "cursor" | "ping" | "pong" | "chat" | "auth";
  caseId?: number;
  userId?: string;
  userName?: string;
  userColor?: string;
  content?: string;
  data?: any;
  token?: string;
}

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", 
  "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"
];

class CollaborationService {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, UserPresence> = new Map();
  private casePresence: Map<number, Set<string>> = new Map();
  private pendingAuth: Map<WebSocket, NodeJS.Timeout> = new Map();

  // Rate limiting for WebSocket messages
  private messageRateLimits: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly MAX_MESSAGES_PER_MINUTE = 120;

  initialize(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: "/ws/collaboration",
      verifyClient: (info, callback) => {
        // Try to validate session from cookie
        const cookies = info.req.headers.cookie ? parseCookie(info.req.headers.cookie) : {};
        const token = cookies.session_token;

        if (token) {
          const session = validateSession(token);
          if (session) {
            // Attach session info to request for later use
            (info.req as any).authenticatedUser = {
              userId: session.userId,
              username: session.username,
            };
            callback(true);
            return;
          }
        }

        // Allow connection but require auth message within 5 seconds
        callback(true);
      },
    });

    this.wss.on("connection", (ws, req: IncomingMessage) => {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        || req.socket.remoteAddress
        || "unknown";

      log(`WebSocket client connected from ${ip}`, "collab");

      // Check if pre-authenticated via cookie
      const authenticatedUser = (req as any).authenticatedUser;
      if (authenticatedUser) {
        log(`WebSocket client pre-authenticated as ${authenticatedUser.username}`, "collab");
      } else {
        // Require authentication within 5 seconds
        const timeout = setTimeout(() => {
          const presence = this.clients.get(ws);
          if (!presence?.authenticated) {
            log(`WebSocket client failed to authenticate within timeout`, "collab");
            ws.close(4001, "Authentication timeout");
          }
        }, 5000);
        this.pendingAuth.set(ws, timeout);
      }

      ws.on("message", (data) => {
        try {
          // Rate limiting
          const presence = this.clients.get(ws);
          if (presence) {
            if (!this.checkRateLimit(presence.odId)) {
              ws.send(JSON.stringify({ type: "error", message: "Rate limit exceeded" }));
              return;
            }
          }

          const rawMessage = data.toString();

          // Validate message size (max 64KB)
          if (rawMessage.length > 65536) {
            ws.send(JSON.stringify({ type: "error", message: "Message too large" }));
            return;
          }

          const message: CollaborationMessage = JSON.parse(rawMessage);

          // Sanitize message content
          if (message.content) {
            message.content = this.sanitizeContent(message.content);
          }

          this.handleMessage(ws, message, authenticatedUser, ip);
        } catch (err) {
          log(`Invalid WebSocket message: ${err}`, "collab");
        }
      });

      ws.on("close", () => {
        // Clean up pending auth timeout
        const timeout = this.pendingAuth.get(ws);
        if (timeout) {
          clearTimeout(timeout);
          this.pendingAuth.delete(ws);
        }
        this.handleDisconnect(ws, ip);
      });

      ws.on("error", (err) => {
        log(`WebSocket error: ${err}`, "collab");
        this.handleDisconnect(ws, ip);
      });
    });

    log("Collaboration WebSocket server initialized with authentication", "collab");
  }

  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const limit = this.messageRateLimits.get(userId);

    if (!limit || limit.resetAt < now) {
      this.messageRateLimits.set(userId, { count: 1, resetAt: now + 60000 });
      return true;
    }

    if (limit.count >= this.MAX_MESSAGES_PER_MINUTE) {
      return false;
    }

    limit.count++;
    return true;
  }

  private sanitizeContent(content: string): string {
    // Remove null bytes and limit length
    return content.replace(/\0/g, "").slice(0, 10000);
  }

  private handleMessage(
    ws: WebSocket,
    message: CollaborationMessage,
    authenticatedUser?: { userId: string; username: string },
    ip?: string
  ) {
    switch (message.type) {
      case "auth":
        this.handleAuth(ws, message, ip);
        break;
      case "join":
        this.handleJoin(ws, message, authenticatedUser, ip);
        break;
      case "leave":
        this.handleLeave(ws);
        break;
      case "update":
        this.broadcastUpdate(ws, message);
        break;
      case "cursor":
        this.broadcastCursor(ws, message);
        break;
      case "chat":
        this.broadcastChat(ws, message);
        break;
      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        this.updateActivity(ws);
        break;
    }
  }

  private handleAuth(ws: WebSocket, message: CollaborationMessage, ip?: string) {
    if (!message.token) {
      ws.send(JSON.stringify({ type: "error", message: "Token required" }));
      return;
    }

    const session = validateSession(message.token);
    if (!session) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
      ws.close(4003, "Authentication failed");
      return;
    }

    // Clear pending auth timeout
    const timeout = this.pendingAuth.get(ws);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingAuth.delete(ws);
    }

    // Mark as authenticated
    const presence = this.clients.get(ws);
    if (presence) {
      presence.authenticated = true;
      presence.odId = session.userId;
      presence.odName = session.username;
    }

    ws.send(JSON.stringify({
      type: "auth_success",
      userId: session.userId,
      username: session.username,
    }));

    log(`WebSocket client authenticated as ${session.username}`, "collab");
  }

  private handleJoin(
    ws: WebSocket,
    message: CollaborationMessage,
    authenticatedUser?: { userId: string; username: string },
    ip?: string
  ) {
    if (!message.caseId) {
      ws.send(JSON.stringify({ type: "error", message: "caseId required" }));
      return;
    }

    // Use authenticated user info if available, otherwise require auth
    const userId = authenticatedUser?.userId || message.userId;
    const userName = authenticatedUser?.username || message.userName;

    if (!userId) {
      ws.send(JSON.stringify({ type: "error", message: "Authentication required" }));
      ws.close(4001, "Authentication required");
      return;
    }

    const userColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const presence: UserPresence = {
      odId: userId,
      odName: userName || `User ${userId.slice(0, 4)}`,
      odColor: message.userColor || userColor,
      caseId: message.caseId,
      joinedAt: new Date(),
      lastActivity: new Date(),
      authenticated: !!authenticatedUser,
    };

    this.clients.set(ws, presence);

    if (!this.casePresence.has(message.caseId)) {
      this.casePresence.set(message.caseId, new Set());
    }
    this.casePresence.get(message.caseId)!.add(userId);

    log(`User ${presence.odName} joined case ${message.caseId}`, "collab");

    // Audit log
    auditLog({
      action: AuditAction.COLLABORATION_JOINED,
      userId,
      resourceType: ResourceType.CASE,
      resourceId: message.caseId,
      ip,
      details: { caseId: message.caseId },
    });

    this.broadcastPresence(message.caseId);
  }

  private handleLeave(ws: WebSocket) {
    this.handleDisconnect(ws, undefined);
  }

  private handleDisconnect(ws: WebSocket, ip?: string) {
    const presence = this.clients.get(ws);
    if (presence) {
      log(`User ${presence.odName} left case ${presence.caseId}`, "collab");

      // Audit log
      auditLog({
        action: AuditAction.COLLABORATION_LEFT,
        userId: presence.odId,
        resourceType: ResourceType.CASE,
        resourceId: presence.caseId,
        ip,
        details: { caseId: presence.caseId },
      });

      const caseUsers = this.casePresence.get(presence.caseId);
      if (caseUsers) {
        caseUsers.delete(presence.odId);
        if (caseUsers.size === 0) {
          this.casePresence.delete(presence.caseId);
        }
      }

      this.clients.delete(ws);
      this.broadcastPresence(presence.caseId);
    }
  }

  private updateActivity(ws: WebSocket) {
    const presence = this.clients.get(ws);
    if (presence) {
      presence.lastActivity = new Date();
    }
  }

  private broadcastPresence(caseId: number) {
    const usersInCase: Array<{ id: string; name: string; color: string }> = [];
    
    this.clients.forEach((presence) => {
      if (presence.caseId === caseId) {
        usersInCase.push({
          id: presence.odId,
          name: presence.odName,
          color: presence.odColor,
        });
      }
    });

    const message = JSON.stringify({
      type: "presence",
      caseId,
      users: usersInCase,
    });

    this.clients.forEach((presence, client) => {
      if (presence.caseId === caseId && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private broadcastUpdate(senderWs: WebSocket, message: CollaborationMessage) {
    const senderPresence = this.clients.get(senderWs);
    if (!senderPresence) return;

    const updateMessage = JSON.stringify({
      type: "update",
      caseId: senderPresence.caseId,
      userId: senderPresence.odId,
      userName: senderPresence.odName,
      data: message.data,
    });

    this.clients.forEach((presence, client) => {
      if (
        presence.caseId === senderPresence.caseId && 
        client !== senderWs && 
        client.readyState === WebSocket.OPEN
      ) {
        client.send(updateMessage);
      }
    });
  }

  private broadcastCursor(senderWs: WebSocket, message: CollaborationMessage) {
    const senderPresence = this.clients.get(senderWs);
    if (!senderPresence) return;

    const cursorMessage = JSON.stringify({
      type: "cursor",
      userId: senderPresence.odId,
      userName: senderPresence.odName,
      userColor: senderPresence.odColor,
      data: message.data,
    });

    this.clients.forEach((presence, client) => {
      if (
        presence.caseId === senderPresence.caseId && 
        client !== senderWs && 
        client.readyState === WebSocket.OPEN
      ) {
        client.send(cursorMessage);
      }
    });
  }

  private broadcastChat(senderWs: WebSocket, message: CollaborationMessage) {
    const senderPresence = this.clients.get(senderWs);
    if (!senderPresence || !message.content) return;

    const chatMessage = JSON.stringify({
      type: "chat",
      caseId: senderPresence.caseId,
      userId: senderPresence.odId,
      userName: senderPresence.odName,
      userColor: senderPresence.odColor,
      content: message.content,
    });

    this.clients.forEach((presence, client) => {
      if (
        presence.caseId === senderPresence.caseId && 
        client !== senderWs && 
        client.readyState === WebSocket.OPEN
      ) {
        client.send(chatMessage);
      }
    });
  }

  getCasePresence(caseId: number): Array<{ id: string; name: string; color: string }> {
    const users: Array<{ id: string; name: string; color: string }> = [];
    this.clients.forEach((presence) => {
      if (presence.caseId === caseId) {
        users.push({
          id: presence.odId,
          name: presence.odName,
          color: presence.odColor,
        });
      }
    });
    return users;
  }

  notifyCaseUpdate(caseId: number, updateType: string, data: any) {
    const message = JSON.stringify({
      type: "update",
      caseId,
      data: { updateType, ...data },
    });

    this.clients.forEach((presence, client) => {
      if (presence.caseId === caseId && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

export const collaborationService = new CollaborationService();
