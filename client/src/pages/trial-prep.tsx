import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import {
  Gavel,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Lightbulb,
  MessageSquare,
  User,
  Users,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronRight,
  HelpCircle,
  Send,
  Info,
  Download,
  Save,
  FileText,
  Clock,
  Trash2,
  History
} from "lucide-react";

interface Case {
  id: number;
  title: string;
  caseNumber: string;
  client: string;
  description: string | null;
  representationType: string | null;
  opposingParty: string | null;
  caseTheory: string | null;
  winningFactors: string | null;
  trappingFactors: string | null;
}

interface SimulationMessage {
  id: string;
  role: "user" | "opponent" | "coach" | "system";
  content: string;
  timestamp: Date;
  coaching?: {
    suggestedResponses: string[];
    warnings: string[];
    tips: string[];
  };
}

interface TrialPrepSession {
  id: number;
  caseId: number;
  sessionMode: string;
  transcript: SimulationMessage[];
  allTips: string[] | null;
  allWarnings: string[] | null;
  allSuggestedResponses: string[] | null;
  notes: string | null;
  duration: number | null;
  createdAt: string;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export default function TrialPrepPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [simulationMode, setSimulationMode] = useState<"cross-examination" | "direct-examination" | "opening" | "closing">("cross-examination");
  const [isSimulationActive, setIsSimulationActive] = useState(false);
  const [messages, setMessages] = useState<SimulationMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [sessionNotes, setSessionNotes] = useState("");
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [allTips, setAllTips] = useState<string[]>([]);
  const [allWarnings, setAllWarnings] = useState<string[]>([]);
  const [allSuggestedResponses, setAllSuggestedResponses] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("simulation");

  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const { data: pastSessions = [] } = useQuery<TrialPrepSession[]>({
    queryKey: [`/api/cases/${selectedCaseId}/trial-prep-sessions`],
    enabled: !!selectedCaseId,
  });

  const saveSessionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/cases/${selectedCaseId}/trial-prep-sessions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${selectedCaseId}/trial-prep-sessions`] });
      toast({ title: "Session Saved", description: "Your practice session has been saved." });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/trial-prep-sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${selectedCaseId}/trial-prep-sessions`] });
      toast({ title: "Session Deleted" });
    },
  });

  const selectedCase = cases.find(c => c.id === selectedCaseId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const hasSpeechRecognition = typeof window !== "undefined" && 
      ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
    
    setSpeechSupported(hasSpeechRecognition);
    
    if (!hasSpeechRecognition) {
      return () => {};
    }
    
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = "en-US";

    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setCurrentTranscript(interimTranscript);

      if (finalTranscript) {
        handleUserSpeech(finalTranscript);
        setCurrentTranscript("");
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        toast({
          title: "Voice Recognition Error",
          description: "There was an issue with voice recognition. Please try again.",
          variant: "destructive",
        });
      }
    };

    recognitionRef.current.onend = () => {
      if (isListening && isSimulationActive) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.log("Recognition already started");
        }
      }
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isListening, isSimulationActive]);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith("en-") && v.name.includes("Google"));
    if (englishVoice) utterance.voice = englishVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  const handleUserSpeech = async (transcript: string) => {
    if (!selectedCase || !isSimulationActive) return;

    const userMessage: SimulationMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: transcript,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      const response = await fetch("/api/trial-simulation/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase.id,
          mode: simulationMode,
          userStatement: transcript,
          conversationHistory: messages.slice(-10),
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      if (data.suggestedResponses) {
        setAllSuggestedResponses(prev => [...new Set([...prev, ...data.suggestedResponses])]);
      }
      if (data.warnings) {
        setAllWarnings(prev => [...new Set([...prev, ...data.warnings])]);
      }
      if (data.tips) {
        setAllTips(prev => [...new Set([...prev, ...data.tips])]);
      }

      const opponentMessage: SimulationMessage = {
        id: `opponent-${Date.now()}`,
        role: "opponent",
        content: data.opponentResponse,
        timestamp: new Date(),
        coaching: {
          suggestedResponses: data.suggestedResponses || [],
          warnings: data.warnings || [],
          tips: data.tips || [],
        },
      };

      setMessages(prev => [...prev, opponentMessage]);
      speak(data.opponentResponse);
    } catch (error) {
      console.error("Simulation error:", error);
      toast({
        title: "Simulation Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const startSimulation = async () => {
    if (!selectedCase) {
      toast({
        title: "Select a Case",
        description: "Please select a case to begin the trial simulation.",
        variant: "destructive",
      });
      return;
    }

    setIsSimulationActive(true);
    setMessages([]);
    setAllTips([]);
    setAllWarnings([]);
    setAllSuggestedResponses([]);
    setSessionStartTime(new Date());

    try {
      const response = await fetch("/api/trial-simulation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase.id,
          mode: simulationMode,
        }),
      });

      if (!response.ok) throw new Error("Failed to start simulation");

      const data = await response.json();

      if (data.suggestedResponses) {
        setAllSuggestedResponses(data.suggestedResponses);
      }
      if (data.warnings) {
        setAllWarnings(data.warnings);
      }
      if (data.tips) {
        setAllTips(data.tips);
      }

      const systemMessage: SimulationMessage = {
        id: `system-${Date.now()}`,
        role: "system",
        content: data.introduction,
        timestamp: new Date(),
      };

      const opponentMessage: SimulationMessage = {
        id: `opponent-${Date.now() + 1}`,
        role: "opponent",
        content: data.openingStatement,
        timestamp: new Date(),
        coaching: {
          suggestedResponses: data.suggestedResponses || [],
          warnings: data.warnings || [],
          tips: data.tips || [],
        },
      };

      setMessages([systemMessage, opponentMessage]);
      speak(data.openingStatement);

      toast({
        title: "Simulation Started",
        description: `${simulationMode.replace("-", " ")} simulation is now active. Click the microphone to speak!`,
      });
    } catch (error) {
      console.error("Failed to start simulation:", error);
      toast({
        title: "Failed to Start",
        description: "Could not initialize the trial simulation.",
        variant: "destructive",
      });
      setIsSimulationActive(false);
    }
  };

  const stopSimulation = () => {
    setIsSimulationActive(false);
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const saveSession = async () => {
    if (!selectedCase || messages.length === 0) return;

    const duration = sessionStartTime 
      ? Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000)
      : null;

    await saveSessionMutation.mutateAsync({
      sessionMode: simulationMode,
      transcript: messages,
      allTips,
      allWarnings,
      allSuggestedResponses,
      notes: sessionNotes,
      duration,
    });
  };

  const exportSession = (session?: TrialPrepSession) => {
    const dataToExport = session || {
      caseTitle: selectedCase?.title,
      caseNumber: selectedCase?.caseNumber,
      sessionMode: simulationMode,
      transcript: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
      allTips,
      allWarnings,
      allSuggestedResponses,
      notes: sessionNotes,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-prep-${selectedCase?.caseNumber || "session"}-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({
        title: "Voice Not Supported",
        description: "Your browser doesn't support voice recognition. Please use Chrome or type your responses.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast({
          title: "Listening...",
          description: "Speak now. Your voice is being recorded.",
        });
      } catch (e) {
        console.log("Recognition error:", e);
      }
    }
  };

  const resetSimulation = () => {
    stopSimulation();
    setMessages([]);
    setCurrentTranscript("");
    setAllTips([]);
    setAllWarnings([]);
    setAllSuggestedResponses([]);
    setSessionNotes("");
  };

  const latestCoaching = messages.filter(m => m.coaching).slice(-1)[0]?.coaching;

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-3">
              <Gavel className="w-8 h-8 text-primary" />
              Trial Preparation & Simulation
            </h1>
            <p className="text-muted-foreground mt-1">
              Practice your case with AI-powered voice simulation and real-time coaching
            </p>
          </div>
          
          <div className="flex gap-2">
            {isSimulationActive && messages.length > 0 && (
              <>
                <Button variant="outline" onClick={saveSession} disabled={saveSessionMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Session
                </Button>
                <Button variant="outline" onClick={() => exportSession()}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <Select
            value={selectedCaseId?.toString() || ""}
            onValueChange={(v) => setSelectedCaseId(parseInt(v))}
          >
            <SelectTrigger className="w-full md:w-[300px]" data-testid="select-case">
              <SelectValue placeholder="Select a case to practice" />
            </SelectTrigger>
            <SelectContent>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.title} ({c.caseNumber})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select
            value={simulationMode}
            onValueChange={(v: any) => setSimulationMode(v)}
          >
            <SelectTrigger className="w-full md:w-[200px]" data-testid="select-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cross-examination">Cross-Examination</SelectItem>
              <SelectItem value="direct-examination">Direct Examination</SelectItem>
              <SelectItem value="opening">Opening Statement</SelectItem>
              <SelectItem value="closing">Closing Argument</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="simulation" className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Simulation
            </TabsTrigger>
            <TabsTrigger value="tips" className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Tips & Angles
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="simulation" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    {selectedCase && (
                      <div className="p-3 bg-muted/50 rounded-lg text-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{selectedCase.representationType || "Plaintiff"}</Badge>
                          <span className="text-muted-foreground">representing</span>
                          <span className="font-medium">{selectedCase.client}</span>
                        </div>
                        {selectedCase.opposingParty && (
                          <p className="text-muted-foreground">vs. {selectedCase.opposingParty}</p>
                        )}
                      </div>
                    )}
                  </CardHeader>

                  <CardContent>
                    <div className="bg-slate-900 rounded-lg min-h-[400px] flex flex-col">
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                          {messages.length === 0 && !isSimulationActive && (
                            <div className="text-center py-16 text-slate-400">
                              <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
                              <p className="text-lg mb-2">Ready to Practice?</p>
                              <p className="text-sm mb-4">
                                Select a case and simulation mode, then click Start Simulation
                              </p>
                              <p className="text-xs text-slate-500">
                                Use your voice to speak your arguments - the AI will respond and coach you!
                              </p>
                            </div>
                          )}

                          {messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                msg.role === "user" ? "bg-primary text-primary-foreground" :
                                msg.role === "opponent" ? "bg-red-600 text-white" :
                                msg.role === "coach" ? "bg-amber-500 text-white" :
                                "bg-slate-600 text-white"
                              }`}>
                                {msg.role === "user" ? <User className="w-4 h-4" /> :
                                 msg.role === "opponent" ? <Users className="w-4 h-4" /> :
                                 msg.role === "coach" ? <Lightbulb className="w-4 h-4" /> :
                                 <MessageSquare className="w-4 h-4" />}
                              </div>
                              <div className={`max-w-[80%] rounded-lg p-3 ${
                                msg.role === "user" ? "bg-primary text-primary-foreground" :
                                msg.role === "opponent" ? "bg-slate-800 text-white border border-red-600/30" :
                                msg.role === "coach" ? "bg-amber-500/20 text-amber-100 border border-amber-500/30" :
                                "bg-slate-700 text-slate-200"
                              }`}>
                                <p className="text-xs font-medium mb-1 opacity-70">
                                  {msg.role === "user" ? "You (Speaking)" :
                                   msg.role === "opponent" ? "Opposing Counsel" :
                                   msg.role === "coach" ? "Coach" : "System"}
                                </p>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            </div>
                          ))}

                          {currentTranscript && (
                            <div className="flex gap-3 flex-row-reverse">
                              <div className="w-8 h-8 rounded-full bg-primary/50 flex items-center justify-center shrink-0">
                                <Mic className="w-4 h-4 text-white animate-pulse" />
                              </div>
                              <div className="max-w-[80%] rounded-lg p-3 bg-primary/30 text-white border border-primary/50">
                                <p className="text-xs font-medium mb-1 opacity-70">Listening...</p>
                                <p className="text-sm italic">{currentTranscript}</p>
                              </div>
                            </div>
                          )}

                          {isProcessing && (
                            <div className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-red-600/50 flex items-center justify-center shrink-0">
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                              </div>
                              <div className="rounded-lg p-3 bg-slate-800 text-slate-300">
                                <p className="text-sm">Opposing counsel is responding...</p>
                              </div>
                            </div>
                          )}

                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>

                      <div className="p-4 border-t border-slate-700">
                        <div className="flex items-center justify-center gap-4 mb-4">
                          {!isSimulationActive ? (
                            <Button
                              size="lg"
                              onClick={startSimulation}
                              disabled={!selectedCase}
                              className="gap-2"
                              data-testid="button-start-simulation"
                            >
                              <Play className="w-5 h-5" />
                              Start Simulation
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant={isListening ? "default" : "outline"}
                                className={`h-16 w-16 rounded-full transition-all ${isListening ? "bg-red-500 hover:bg-red-600 animate-pulse scale-110" : "border-2"}`}
                                onClick={toggleListening}
                                disabled={!speechSupported}
                                data-testid="button-toggle-mic"
                              >
                                {isListening ? <Mic className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-10 w-10 rounded-full"
                                onClick={() => setVoiceEnabled(!voiceEnabled)}
                                data-testid="button-toggle-voice"
                              >
                                {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-10 w-10 rounded-full"
                                onClick={resetSimulation}
                                data-testid="button-reset"
                              >
                                <RotateCcw className="w-5 h-5" />
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={stopSimulation}
                                className="gap-2"
                                data-testid="button-stop-simulation"
                              >
                                <Pause className="w-4 h-4" />
                                End Session
                              </Button>
                            </>
                          )}
                        </div>
                        
                        {isSimulationActive && (
                          <div className="space-y-3">
                            {isListening && (
                              <div className="text-center text-green-400 text-sm animate-pulse">
                                Speak now - your voice is being captured...
                              </div>
                            )}
                            {!speechSupported && (
                              <div className="flex items-center gap-2 p-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-200 text-sm">
                                <Info className="w-4 h-4 shrink-0" />
                                <span>Voice recognition not supported. Use text input below or try Chrome browser.</span>
                              </div>
                            )}
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (textInput.trim() && !isProcessing) {
                                  handleUserSpeech(textInput.trim());
                                  setTextInput("");
                                }
                              }}
                              className="flex gap-2"
                            >
                              <Input
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                placeholder="Or type your statement here..."
                                className="flex-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                                disabled={isProcessing}
                                data-testid="input-text-fallback"
                              />
                              <Button
                                type="submit"
                                disabled={!textInput.trim() || isProcessing}
                                size="icon"
                                data-testid="button-send-text"
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      Live Coaching
                    </CardTitle>
                    <CardDescription>
                      AI suggestions based on your case and conversation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!isSimulationActive ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Start a simulation to receive real-time coaching
                      </p>
                    ) : latestCoaching ? (
                      <>
                        {latestCoaching.suggestedResponses.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                              <ChevronRight className="w-4 h-4 text-green-500" />
                              Suggested Responses
                            </h4>
                            <div className="space-y-2">
                              {latestCoaching.suggestedResponses.map((response, i) => (
                                <div
                                  key={i}
                                  className="text-sm p-2 bg-green-500/10 border border-green-500/20 rounded-lg cursor-pointer hover:bg-green-500/20 transition-colors"
                                  onClick={() => handleUserSpeech(response)}
                                >
                                  "{response}"
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {latestCoaching.warnings.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              Watch Out
                            </h4>
                            <div className="space-y-2">
                              {latestCoaching.warnings.map((warning, i) => (
                                <div
                                  key={i}
                                  className="text-sm p-2 bg-red-500/10 border border-red-500/20 rounded-lg"
                                >
                                  {warning}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {latestCoaching.tips.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                              <CheckCircle className="w-4 h-4 text-blue-500" />
                              Tips
                            </h4>
                            <div className="space-y-2">
                              {latestCoaching.tips.map((tip, i) => (
                                <div
                                  key={i}
                                  className="text-sm p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg"
                                >
                                  {tip}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mt-2">
                          Waiting for conversation...
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {selectedCase && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <HelpCircle className="w-5 h-5 text-primary" />
                        Case Strategy
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {selectedCase.caseTheory && (
                        <div>
                          <p className="font-medium text-muted-foreground">Theory:</p>
                          <p>{selectedCase.caseTheory}</p>
                        </div>
                      )}
                      {selectedCase.winningFactors && (
                        <div>
                          <p className="font-medium text-green-600">Winning Factors:</p>
                          <p>{selectedCase.winningFactors}</p>
                        </div>
                      )}
                      {selectedCase.trappingFactors && (
                        <div>
                          <p className="font-medium text-red-600">Trap Points:</p>
                          <p>{selectedCase.trappingFactors}</p>
                        </div>
                      )}
                      {!selectedCase.caseTheory && !selectedCase.winningFactors && !selectedCase.trappingFactors && (
                        <p className="text-muted-foreground text-center py-4">
                          Add case strategy details to improve AI coaching
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tips" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    Collected Tips ({allTips.length})
                  </CardTitle>
                  <CardDescription>Strategic tips gathered during your practice sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  {allTips.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Tips will appear here as you practice
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {allTips.map((tip, i) => (
                        <div key={i} className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
                          {tip}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Warnings to Remember ({allWarnings.length})
                  </CardTitle>
                  <CardDescription>Potential pitfalls to avoid during trial</CardDescription>
                </CardHeader>
                <CardContent>
                  {allWarnings.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Warnings will appear here as you practice
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {allWarnings.map((warning, i) => (
                        <div key={i} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm">
                          {warning}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChevronRight className="w-5 h-5 text-green-500" />
                    Suggested Angles & Responses ({allSuggestedResponses.length})
                  </CardTitle>
                  <CardDescription>Effective responses and angles to consider</CardDescription>
                </CardHeader>
                <CardContent>
                  {allSuggestedResponses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Suggested responses will appear here as you practice
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {allSuggestedResponses.map((response, i) => (
                        <div key={i} className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm">
                          "{response}"
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Past Sessions ({pastSessions.length})
                  </CardTitle>
                  <CardDescription>Previously saved practice sessions for this case</CardDescription>
                </CardHeader>
                <CardContent>
                  {pastSessions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      {selectedCaseId ? "No saved sessions yet. Complete a practice session and save it!" : "Select a case to view past sessions"}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pastSessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{session.sessionMode.replace("-", " ")}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(session.createdAt).toLocaleDateString()} - {(session.transcript as any[])?.length || 0} messages
                              {session.duration && ` - ${Math.floor(session.duration / 60)}m ${session.duration % 60}s`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => exportSession(session)}>
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => deleteSessionMutation.mutate(session.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Session Notes
                </CardTitle>
                <CardDescription>
                  Take notes during your practice session. These will be saved with your session.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Write your notes here... Key observations, areas to improve, questions to research, etc."
                  className="min-h-[400px]"
                  data-testid="textarea-notes"
                />
                <div className="mt-4 flex justify-end">
                  <Button onClick={saveSession} disabled={!selectedCase || messages.length === 0 || saveSessionMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Notes with Session
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
