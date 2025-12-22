import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  MessageCircle, 
  Send, 
  X, 
  Minimize2,
  Maximize2
} from "lucide-react";

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  content: string;
  timestamp: Date;
}

interface CollaborationChatProps {
  caseId: number;
  userId: string;
  userName: string;
  userColor?: string;
  onClose: () => void;
}

export function CollaborationChat({ caseId, userId, userName, userColor = "#3b82f6", onClose }: CollaborationChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldReconnectRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const connect = () => {
      if (!shouldReconnectRef.current) return;
      
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/collaboration`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "join",
          caseId,
          userId,
          userName,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "chat" && data.caseId === caseId) {
            const newMessage: ChatMessage = {
              id: `${Date.now()}-${Math.random()}`,
              userId: data.userId,
              userName: data.userName,
              userColor: data.userColor || "#3b82f6",
              content: data.content,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, newMessage]);
            
            if (isMinimized && data.userId !== userId) {
              setUnreadCount(prev => prev + 1);
            }
          }
        } catch (err) {
          console.error("Failed to parse chat message:", err);
        }
      };

      ws.onclose = () => {
        if (shouldReconnectRef.current) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [caseId, userId, userName, isMinimized]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!inputValue.trim() || !wsRef.current) return;

    const messageData = {
      type: "chat",
      caseId,
      userId,
      userName,
      userColor,
      content: inputValue.trim(),
    };

    wsRef.current.send(JSON.stringify(messageData));
    
    setMessages(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      userId,
      userName,
      userColor,
      content: inputValue.trim(),
      timestamp: new Date(),
    }]);
    
    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isMinimized) {
    return (
      <Card 
        className="fixed bottom-4 left-4 z-50 p-3 shadow-lg bg-background/95 backdrop-blur border-primary/20 cursor-pointer"
        onClick={() => { setIsMinimized(false); setUnreadCount(0); }}
      >
        <div className="flex items-center gap-3">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Chat</span>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-4 left-4 z-50 w-[calc(100vw-2rem)] sm:w-[320px] h-[350px] sm:h-[400px] shadow-2xl bg-background/95 backdrop-blur border-primary/20 flex flex-col overflow-hidden" data-testid="collaboration-chat">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Team Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(true)}>
            <Minimize2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-4">
            <MessageCircle className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-2 ${msg.userId === userId ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarFallback 
                    className="text-[10px] font-semibold text-white"
                    style={{ backgroundColor: msg.userColor }}
                  >
                    {msg.userName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[200px] ${msg.userId === userId ? "text-right" : ""}`}>
                  <p className="text-xs text-muted-foreground mb-1">
                    {msg.userId === userId ? "You" : msg.userName}
                  </p>
                  <div 
                    className={`rounded-lg px-3 py-2 text-sm ${
                      msg.userId === userId 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      <div className="p-3 border-t bg-muted/30">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 h-9"
            data-testid="input-chat-message"
          />
          <Button 
            size="icon" 
            className="h-9 w-9 shrink-0" 
            onClick={sendMessage}
            disabled={!inputValue.trim()}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
