import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { log } from "../index";

interface UserPresence {
  odId: string;
  odName: string;
  odColor: string;
  caseId: number;
  joinedAt: Date;
  lastActivity: Date;
}

interface CollaborationMessage {
  type: "join" | "leave" | "presence" | "update" | "cursor" | "ping" | "pong" | "chat";
  caseId?: number;
  userId?: string;
  userName?: string;
  userColor?: string;
  content?: string;
  data?: any;
}

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", 
  "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"
];

class CollaborationService {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, UserPresence> = new Map();
  private casePresence: Map<number, Set<string>> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: "/ws/collaboration" 
    });

    this.wss.on("connection", (ws) => {
      log("WebSocket client connected", "collab");

      ws.on("message", (data) => {
        try {
          const message: CollaborationMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (err) {
          log(`Invalid WebSocket message: ${err}`, "collab");
        }
      });

      ws.on("close", () => {
        this.handleDisconnect(ws);
      });

      ws.on("error", (err) => {
        log(`WebSocket error: ${err}`, "collab");
        this.handleDisconnect(ws);
      });
    });

    log("Collaboration WebSocket server initialized", "collab");
  }

  private handleMessage(ws: WebSocket, message: CollaborationMessage) {
    switch (message.type) {
      case "join":
        this.handleJoin(ws, message);
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

  private handleJoin(ws: WebSocket, message: CollaborationMessage) {
    if (!message.caseId || !message.userId) return;

    const userColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const presence: UserPresence = {
      odId: message.userId,
      odName: message.userName || `User ${message.userId.slice(0, 4)}`,
      odColor: message.userColor || userColor,
      caseId: message.caseId,
      joinedAt: new Date(),
      lastActivity: new Date(),
    };

    this.clients.set(ws, presence);

    if (!this.casePresence.has(message.caseId)) {
      this.casePresence.set(message.caseId, new Set());
    }
    this.casePresence.get(message.caseId)!.add(message.userId);

    log(`User ${presence.odName} joined case ${message.caseId}`, "collab");

    this.broadcastPresence(message.caseId);
  }

  private handleLeave(ws: WebSocket) {
    this.handleDisconnect(ws);
  }

  private handleDisconnect(ws: WebSocket) {
    const presence = this.clients.get(ws);
    if (presence) {
      log(`User ${presence.odName} left case ${presence.caseId}`, "collab");
      
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
