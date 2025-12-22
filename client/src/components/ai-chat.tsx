import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BrainCircuit, 
  Send, 
  Loader2, 
  Plus, 
  Trash2,
  MessageCircle
} from "lucide-react";
import { 
  getConversations, 
  getConversation, 
  createConversation, 
  deleteConversation, 
  sendChatMessage,
  type Conversation,
  type Message
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface AIChatProps {
  caseId: number;
  caseName: string;
}

export function AIChat({ caseId, caseName }: AIChatProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
  });

  const { data: conversationData, isLoading: loadingMessages } = useQuery({
    queryKey: ["conversation", selectedConversationId],
    queryFn: () => getConversation(selectedConversationId!),
    enabled: !!selectedConversationId,
  });

  useEffect(() => {
    if (conversationData) {
      setMessages(conversationData.messages || []);
    }
  }, [conversationData]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const createMutation = useMutation({
    mutationFn: () => createConversation(`Chat about ${caseName}`, caseId),
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setSelectedConversationId(newConversation.id);
      setMessages([]);
    },
    onError: () => {
      toast({
        title: "Failed to create conversation",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (selectedConversationId) {
        setSelectedConversationId(null);
        setMessages([]);
      }
    },
  });

  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming) return;

    let conversationId = selectedConversationId;
    
    if (!conversationId) {
      const newConv = await createConversation(`Chat about ${caseName}`, caseId);
      conversationId = newConv.id;
      setSelectedConversationId(newConv.id);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }

    const userMessage: Message = {
      id: Date.now(),
      conversationId: conversationId,
      role: "user",
      content: inputValue,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      await sendChatMessage(conversationId, userMessage.content, (chunk) => {
        setStreamingContent(prev => prev + chunk);
      });

      const assistantMessage: Message = {
        id: Date.now() + 1,
        conversationId: conversationId,
        role: "assistant",
        content: streamingContent,
        createdAt: new Date().toISOString(),
      };

      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    } catch (error) {
      toast({
        title: "Failed to send message",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex gap-4" data-testid="ai-chat-container">
      <div className="w-48 md:w-64 border-r pr-4 flex flex-col">
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          size="sm"
          className="mb-4 gap-2"
          data-testid="button-new-chat"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>

        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {loadingConversations && (
              <div className="text-sm text-muted-foreground text-center py-4">
                Loading...
              </div>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedConversationId === conv.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                }`}
                onClick={() => setSelectedConversationId(conv.id)}
                data-testid={`conversation-${conv.id}`}
              >
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm truncate flex-1">{conv.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(conv.id);
                  }}
                  data-testid={`delete-conversation-${conv.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {!loadingConversations && conversations.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                No conversations yet
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {!selectedConversationId && messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <BrainCircuit className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-lg font-semibold mb-2">AI Legal Assistant</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Ask questions about your case, get legal insights, research precedents, 
              or get help drafting documents. The AI has context about all files in this case.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-lg">
              {[
                "Summarize the key facts of this case",
                "What are the strongest arguments for the defense?",
                "Find inconsistencies in the witness testimony",
                "Draft a motion to dismiss outline",
              ].map((prompt) => (
                <button
                  key={prompt}
                  className="text-left text-sm p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setInputValue(prompt);
                  }}
                  data-testid={`prompt-suggestion-${prompt.slice(0, 20)}`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4 max-w-3xl mx-auto">
              {loadingMessages && (
                <div className="text-center text-muted-foreground py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading messages...
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.id}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isStreaming && streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted">
                    <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                    <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-1" />
                  </div>
                </div>
              )}
              {isStreaming && !streamingContent && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="border-t p-4">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Input
              placeholder="Ask about your case..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              className="flex-1"
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isStreaming}
              data-testid="button-send-message"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
