import { useState, useEffect, useRef, useCallback } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Monitor, 
  Users,
  Maximize2,
  Minimize2,
  X,
  Loader2,
  Link,
  Check,
  Circle,
  StopCircle,
  MessageSquare
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

interface VideoCallPanelProps {
  caseId: number;
  caseName: string;
  userId: string;
  userName: string;
  onClose: () => void;
}

export function VideoCallPanel({ caseId, caseName, userId, userName, onClose }: VideoCallPanelProps) {
  const { toast } = useToast();
  const [callState, setCallState] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  
  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  
  const callRef = useRef<DailyCall | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptEntries]);

  // Recording timer - update elapsed time every second
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRecording && recordingStartTime) {
      interval = setInterval(() => {
        setRecordingElapsed(Math.floor((Date.now() - recordingStartTime.getTime()) / 1000));
      }, 1000);
    } else {
      setRecordingElapsed(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, recordingStartTime]);

  // Format elapsed seconds to MM:SS
  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyInviteLink = useCallback(async () => {
    if (roomUrl) {
      try {
        await navigator.clipboard.writeText(roomUrl);
        setLinkCopied(true);
        toast({
          title: "Link copied!",
          description: "Share this link with Ben to join the video call",
        });
        setTimeout(() => setLinkCopied(false), 3000);
      } catch (err) {
        toast({
          title: "Failed to copy link",
          description: roomUrl,
          variant: "destructive",
        });
      }
    }
  }, [roomUrl, toast]);

  const startRecording = useCallback(async () => {
    if (callRef.current && callState === "joined") {
      try {
        await callRef.current.startRecording({
          layout: { preset: "default" },
        });
        setIsRecording(true);
        setRecordingStartTime(new Date());
        toast({ title: "Recording started", description: "This call is now being recorded" });
      } catch (err) {
        console.error("Failed to start recording:", err);
        toast({ title: "Failed to start recording", variant: "destructive" });
      }
    }
  }, [callState, toast]);

  const stopRecording = useCallback(async () => {
    if (callRef.current && isRecording) {
      try {
        await callRef.current.stopRecording();
        setIsRecording(false);
        setRecordingStartTime(null);
        toast({ title: "Recording stopped", description: "Recording has been saved" });
        
        // Notify server about the recording
        if (roomName) {
          fetch(`/api/cases/${caseId}/call-recording`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomName, transcript: transcriptEntries }),
          }).catch(console.error);
        }
      } catch (err) {
        console.error("Failed to stop recording:", err);
        toast({ title: "Failed to stop recording", variant: "destructive" });
      }
    }
  }, [isRecording, caseId, roomName, transcriptEntries, toast]);

  const startTranscription = useCallback(async () => {
    if (callRef.current && callState === "joined") {
      try {
        await callRef.current.startTranscription({
          language: "en",
          model: "nova-2",
          punctuate: true,
          includeRawResponse: true,
        });
        setIsTranscribing(true);
        setShowTranscript(true);
        toast({ title: "Transcription started", description: "Live transcript is now active" });
      } catch (err) {
        console.error("Failed to start transcription:", err);
        toast({ title: "Failed to start transcription", description: "Transcription may require additional setup", variant: "destructive" });
      }
    }
  }, [callState, toast]);

  const stopTranscription = useCallback(async () => {
    if (callRef.current && isTranscribing) {
      try {
        await callRef.current.stopTranscription();
        setIsTranscribing(false);
        toast({ title: "Transcription stopped" });
      } catch (err) {
        console.error("Failed to stop transcription:", err);
      }
    }
  }, [isTranscribing, toast]);

  const createOrJoinRoom = useCallback(async () => {
    setCallState("joining");
    setError(null);
    
    try {
      const response = await fetch(`/api/cases/${caseId}/video-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create video room");
      }
      
      const data = await response.json();
      setRoomUrl(data.url);
      setRoomName(data.roomName);
      
      if (!callRef.current) {
        callRef.current = DailyIframe.createCallObject({
          showLeaveButton: false,
          showFullscreenButton: false,
        });
      }

      callRef.current.on("joined-meeting", () => {
        setCallState("joined");
        updateParticipantCount();
      });

      callRef.current.on("left-meeting", () => {
        setCallState("idle");
        setParticipantCount(0);
        setIsRecording(false);
        setIsTranscribing(false);
      });

      callRef.current.on("participant-joined", updateParticipantCount);
      callRef.current.on("participant-left", updateParticipantCount);

      // Transcription events
      callRef.current.on("transcription-message", (event: any) => {
        if (event && event.text) {
          const newEntry: TranscriptEntry = {
            id: `${Date.now()}-${Math.random()}`,
            speaker: event.user_name || event.user_id || "Unknown",
            text: event.text,
            timestamp: new Date(),
            isFinal: event.is_final !== false,
          };
          
          setTranscriptEntries(prev => {
            // Update existing entry if not final, or add new one
            if (!newEntry.isFinal) {
              const existing = prev.findIndex(e => e.speaker === newEntry.speaker && !e.isFinal);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = newEntry;
                return updated;
              }
            }
            return [...prev, newEntry].slice(-100); // Keep last 100 entries
          });
        }
      });

      callRef.current.on("transcription-started", () => {
        setIsTranscribing(true);
      });

      callRef.current.on("transcription-stopped", () => {
        setIsTranscribing(false);
      });

      // Recording events
      callRef.current.on("recording-started", () => {
        setIsRecording(true);
        setRecordingStartTime(new Date());
      });

      callRef.current.on("recording-stopped", () => {
        setIsRecording(false);
        setRecordingStartTime(null);
      });

      callRef.current.on("error", (e) => {
        console.error("Daily error:", e);
        setError("Video call error occurred");
        setCallState("error");
      });

      await callRef.current.join({ 
        url: data.url,
        userName: userName,
      });
      
    } catch (err) {
      console.error("Failed to join video call:", err);
      setError(err instanceof Error ? err.message : "Failed to join video call");
      setCallState("error");
    }
  }, [caseId, userId, userName]);

  const updateParticipantCount = useCallback(() => {
    if (callRef.current) {
      const participants = callRef.current.participants();
      setParticipantCount(Object.keys(participants).length);
    }
  }, []);

  const leaveCall = useCallback(async () => {
    // Stop recording and transcription before leaving
    if (isRecording) {
      await stopRecording();
    }
    if (isTranscribing) {
      await stopTranscription();
    }
    
    if (callRef.current) {
      await callRef.current.leave();
      callRef.current.destroy();
      callRef.current = null;
    }
    
    try {
      await fetch(`/api/cases/${caseId}/video-room`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    } catch (err) {
      console.error("Failed to notify leave:", err);
    }
    
    setCallState("idle");
    setRoomUrl(null);
    setRoomName(null);
    setTranscriptEntries([]);
  }, [caseId, userId, isRecording, isTranscribing, stopRecording, stopTranscription]);

  const toggleMute = useCallback(() => {
    if (callRef.current) {
      const newMuted = !isMuted;
      callRef.current.setLocalAudio(!newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  const toggleVideo = useCallback(() => {
    if (callRef.current) {
      const newVideoOff = !isVideoOff;
      callRef.current.setLocalVideo(!newVideoOff);
      setIsVideoOff(newVideoOff);
    }
  }, [isVideoOff]);

  const toggleScreenShare = useCallback(async () => {
    if (callRef.current) {
      if (isScreenSharing) {
        await callRef.current.stopScreenShare();
      } else {
        await callRef.current.startScreenShare();
      }
      setIsScreenSharing(!isScreenSharing);
    }
  }, [isScreenSharing]);

  useEffect(() => {
    return () => {
      if (callRef.current) {
        callRef.current.leave();
        callRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (callRef.current && containerRef.current && callState === "joined") {
      const iframe = callRef.current.iframe();
      if (iframe) {
        containerRef.current.innerHTML = "";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.style.borderRadius = "8px";
        containerRef.current.appendChild(iframe);
      }
    }
  }, [callState]);

  const handleClose = async () => {
    await leaveCall();
    onClose();
  };

  if (isMinimized) {
    return (
      <Card className="fixed bottom-4 right-4 z-50 p-3 shadow-lg bg-background/95 backdrop-blur border-primary/20">
        <div className="flex items-center gap-3">
          {isRecording && (
            <div className="flex items-center gap-1 text-red-500 animate-pulse">
              <Circle className="w-3 h-3 fill-red-500" />
              <span className="text-xs font-mono">{formatElapsedTime(recordingElapsed)}</span>
            </div>
          )}
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">Video Call Active</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            {participantCount}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(false)}>
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={handleClose}>
            <PhoneOff className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`fixed bottom-4 right-4 z-50 shadow-2xl bg-background/95 backdrop-blur border-primary/20 flex flex-col overflow-hidden ${showTranscript && callState === "joined" ? "w-[calc(100vw-2rem)] sm:w-[600px] h-[450px]" : "w-[calc(100vw-2rem)] sm:w-[400px] h-[300px] sm:h-[350px]"}`} data-testid="video-call-panel">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-1 text-red-500 animate-pulse">
              <Circle className="w-3 h-3 fill-red-500" />
              <span className="text-xs font-mono">{formatElapsedTime(recordingElapsed)}</span>
            </div>
          )}
          <Video className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium truncate max-w-[150px]">{caseName}</span>
          {callState === "joined" && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              {participantCount}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {callState === "joined" && (
            <Button 
              variant={showTranscript ? "default" : "ghost"} 
              size="icon" 
              className="h-7 w-7"
              onClick={() => setShowTranscript(!showTranscript)}
              title="Toggle transcript"
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(true)}>
            <Minimize2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 flex">
        <div className={`flex-1 bg-slate-900 relative ${showTranscript && callState === "joined" ? "w-1/2" : "w-full"}`} ref={containerRef}>
          {callState === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
              <Video className="w-12 h-12 text-primary" />
              <p className="text-sm text-slate-300">Start a video call with your team</p>
              <Button onClick={createOrJoinRoom} className="gap-2" data-testid="button-join-call">
                <Video className="w-4 h-4" />
                Join Call
              </Button>
            </div>
          )}
          
          {callState === "joining" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-slate-300">Joining video call...</p>
            </div>
          )}
          
          {callState === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
              <VideoOff className="w-12 h-12 text-destructive" />
              <p className="text-sm text-red-400">{error || "Failed to join call"}</p>
              <Button variant="outline" onClick={createOrJoinRoom} className="gap-2">
                Try Again
              </Button>
            </div>
          )}
        </div>
        
        {/* Live Transcript Panel */}
        {showTranscript && callState === "joined" && (
          <div className="w-1/2 border-l bg-background flex flex-col">
            <div className="p-2 border-b bg-muted/30 flex items-center justify-between">
              <span className="text-xs font-medium">Live Transcript</span>
              {isTranscribing ? (
                <div className="flex items-center gap-1 text-green-500">
                  <Circle className="w-2 h-2 fill-green-500 animate-pulse" />
                  <span className="text-xs">Live</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Paused</span>
              )}
            </div>
            <ScrollArea className="flex-1 p-2">
              {transcriptEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {isTranscribing ? "Listening for speech..." : "Start transcription to see live captions"}
                </p>
              ) : (
                <div className="space-y-2">
                  {transcriptEntries.filter(e => e.isFinal).map((entry) => (
                    <div key={entry.id} className="text-xs">
                      <span className="font-medium text-primary">{entry.speaker}: </span>
                      <span className={entry.isFinal ? "" : "text-muted-foreground italic"}>{entry.text}</span>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
      
      {callState === "joined" && (
        <div className="flex items-center justify-center gap-1 sm:gap-2 p-2 sm:p-3 border-t bg-muted/30 flex-wrap">
          <Button 
            variant={isMuted ? "destructive" : "secondary"} 
            size="icon" 
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full"
            onClick={toggleMute}
            data-testid="button-toggle-mute"
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          <Button 
            variant={isVideoOff ? "destructive" : "secondary"} 
            size="icon" 
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full"
            onClick={toggleVideo}
            data-testid="button-toggle-video"
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </Button>
          <Button 
            variant={isScreenSharing ? "default" : "secondary"} 
            size="icon" 
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full"
            onClick={toggleScreenShare}
            data-testid="button-screen-share"
            title="Share your screen"
          >
            <Monitor className="w-4 h-4" />
          </Button>
          <Button 
            variant={isRecording ? "destructive" : "secondary"} 
            size="icon" 
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full"
            onClick={isRecording ? stopRecording : startRecording}
            data-testid="button-toggle-recording"
            title={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? <StopCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
          </Button>
          <Button 
            variant={isTranscribing ? "default" : "secondary"} 
            size="icon" 
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full"
            onClick={isTranscribing ? stopTranscription : startTranscription}
            data-testid="button-toggle-transcription"
            title={isTranscribing ? "Stop transcription" : "Start live transcription"}
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
          <Button 
            variant={linkCopied ? "default" : "outline"} 
            size="icon" 
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full"
            onClick={copyInviteLink}
            data-testid="button-share-link"
            title="Copy invite link to share with others"
          >
            {linkCopied ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
          </Button>
          <Button 
            variant="destructive" 
            size="icon" 
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full"
            onClick={handleClose}
            data-testid="button-end-call"
          >
            <PhoneOff className="w-4 h-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}
