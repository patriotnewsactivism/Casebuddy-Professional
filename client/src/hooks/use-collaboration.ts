import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface CollaboratorUser {
  id: string;
  name: string;
  color: string;
}

interface CollaborationMessage {
  type: "presence" | "update" | "cursor" | "pong";
  caseId?: number;
  userId?: string;
  userName?: string;
  userColor?: string;
  users?: CollaboratorUser[];
  data?: any;
}

function generateUserId(): string {
  const stored = localStorage.getItem("casebuddy_user_id");
  if (stored) return stored;
  
  const newId = `user_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem("casebuddy_user_id", newId);
  return newId;
}

function generateUserName(): string {
  const stored = localStorage.getItem("casebuddy_user_name");
  if (stored) return stored;
  
  const names = ["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Quinn"];
  const newName = names[Math.floor(Math.random() * names.length)];
  localStorage.setItem("casebuddy_user_name", newName);
  return newName;
}

export function useCollaboration(caseId: number | null) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<CollaboratorUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);

  const userId = useRef(user?.id || generateUserId());
  const userName = useRef(user?.username || generateUserName());

  const connect = useCallback(() => {
    if (!caseId || wsRef.current?.readyState === WebSocket.OPEN) return;
    shouldReconnectRef.current = true;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/collaboration`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({
        type: "join",
        caseId,
        userId: userId.current,
        userName: userName.current,
      }));

      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message: CollaborationMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case "presence":
            if (message.users) {
              setCollaborators(message.users.filter(u => u.id !== userId.current));
            }
            break;
          case "update":
            if (message.data?.updateType) {
              queryClient.invalidateQueries({ 
                queryKey: [message.data.updateType, String(caseId)] 
              });
            }
            break;
        }
      } catch (err) {
        console.error("Failed to parse collaboration message:", err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setCollaborators([]);
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      
      if (shouldReconnectRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [caseId, queryClient]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setCollaborators([]);
  }, []);

  const notifyUpdate = useCallback((updateType: string, data?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "update",
        data: { updateType, ...data },
      }));
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      userId.current = user.id;
      userName.current = user.username;
    }
  }, [user]);

  useEffect(() => {
    if (caseId) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [caseId, connect, disconnect]);

  return {
    collaborators,
    isConnected,
    userId: userId.current,
    userName: userName.current,
    notifyUpdate,
  };
}
