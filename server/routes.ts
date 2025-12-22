import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { caseIntakeSchema, insertDiscoveryFileSchema, insertDepositionPrepSchema, insertSuggestedFilingSchema, insertCloudFolderSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { processPDF, processMediaFile, processImage, type CaseContext } from "./services/documentProcessor";
import { generateDepositionQuestions, generateTimelineFromDocuments, suggestNextFilings } from "./services/aiAssistant";
import { registerChatRoutes } from "./replit_integrations/chat";
import { listFolders, listFilesInFolder, getFileMetadata, downloadFile, type DriveFile } from "./services/googleDrive";
import { collaborationService } from "./services/collaboration";
import { getOrCreateRoom, addParticipant, removeParticipant, getRoomParticipants } from "./services/videoRooms";
import type { Request, Response } from "express";

// File upload configuration
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize WebSocket collaboration service
  collaborationService.initialize(httpServer);

  // Register Gemini chat routes
  registerChatRoutes(app);

  // ==================
  // COLLABORATION
  // ==================
  app.get("/api/cases/:id/presence", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.id);
      const users = collaborationService.getCasePresence(caseId);
      res.json({ users });
    } catch (error) {
      console.error("Error fetching presence:", error);
      res.status(500).json({ error: "Failed to fetch presence" });
    }
  });

  // ==================
  // VIDEO CONFERENCING
  // ==================
  app.post("/api/cases/:caseId/video-room", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const { userId, userName } = req.body;

      if (!userId || !userName) {
        return res.status(400).json({ error: "userId and userName are required" });
      }

      // Check if DAILY_API_KEY is configured
      if (!process.env.DAILY_API_KEY) {
        return res.status(500).json({ error: "Video conferencing is not configured. DAILY_API_KEY is missing." });
      }

      const room = await getOrCreateRoom(caseId);
      addParticipant(caseId, userId, userName);

      res.json({ 
        url: room.roomUrl,
        roomName: room.roomName,
        participants: getRoomParticipants(caseId),
      });
    } catch (error) {
      console.error("Error creating video room:", error);
      res.status(500).json({ error: "Failed to create video room" });
    }
  });

  app.get("/api/cases/:caseId/video-room", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const participants = getRoomParticipants(caseId);
      res.json({ participants, active: participants.length > 0 });
    } catch (error) {
      console.error("Error fetching video room:", error);
      res.status(500).json({ error: "Failed to fetch video room" });
    }
  });

  app.delete("/api/cases/:caseId/video-room", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      await removeParticipant(caseId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error leaving video room:", error);
      res.status(500).json({ error: "Failed to leave video room" });
    }
  });

  // Save call recording and transcript
  app.post("/api/cases/:caseId/call-recording", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const { roomName, transcript } = req.body;

      if (!roomName) {
        return res.status(400).json({ error: "roomName is required" });
      }

      // Build transcript text from entries
      let transcriptText = "";
      if (Array.isArray(transcript)) {
        transcriptText = transcript
          .filter((entry: any) => entry.isFinal)
          .map((entry: any) => `${entry.speaker}: ${entry.text}`)
          .join("\n");
      }

      const recording = await storage.createCallRecording({
        caseId,
        roomName,
        transcriptText: transcriptText || null,
        status: "completed",
        endedAt: new Date(),
      });

      res.status(201).json(recording);
    } catch (error) {
      console.error("Error saving call recording:", error);
      res.status(500).json({ error: "Failed to save call recording" });
    }
  });

  // Get call recordings for a case
  app.get("/api/cases/:caseId/call-recordings", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const recordings = await storage.getCallRecordingsByCase(caseId);
      res.json(recordings);
    } catch (error) {
      console.error("Error fetching call recordings:", error);
      res.status(500).json({ error: "Failed to fetch call recordings" });
    }
  });

  // ==================
  // TRIAL SIMULATION
  // ==================
  
  const sanitizeField = (value: string | null | undefined, maxLength: number = 500): string => {
    if (!value) return "";
    return value.slice(0, maxLength).replace(/[\x00-\x1F\x7F]/g, "");
  };
  
  const validSimulationModes = ["cross-examination", "direct-examination", "opening", "closing"];
  
  app.post("/api/trial-simulation/start", async (req: Request, res: Response) => {
    try {
      const { caseId, mode } = req.body;

      if (!caseId || typeof caseId !== "number") {
        return res.status(400).json({ error: "Valid caseId is required" });
      }
      
      if (!mode || !validSimulationModes.includes(mode)) {
        return res.status(400).json({ error: "Valid mode is required (cross-examination, direct-examination, opening, closing)" });
      }

      const caseData = await storage.getCase(caseId);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        httpOptions: {
          apiVersion: "",
          baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
        },
      });

      const modeDescriptions: Record<string, string> = {
        "cross-examination": "You are opposing counsel conducting a cross-examination. Be aggressive but professional. Challenge the attorney's witness.",
        "direct-examination": "You are the witness being questioned by the attorney. Answer based on the case facts. The attorney is guiding you.",
        "opening": "You are opposing counsel responding to opening statements. You will present your side's opening after the attorney.",
        "closing": "You are opposing counsel responding to closing arguments. Present counter-arguments to their case theory.",
      };

      const systemPrompt = `You are an AI legal simulation assistant for trial preparation.

CASE CONTEXT:
- Title: ${sanitizeField(caseData.title, 200)}
- Case Number: ${sanitizeField(caseData.caseNumber, 50) || "N/A"}
- Client: ${sanitizeField(caseData.client, 200)}
- Representation Type: ${sanitizeField(caseData.representationType, 100) || "Plaintiff"}
- Opposing Party: ${sanitizeField(caseData.opposingParty, 200) || "Unknown"}
- Case Theory: ${sanitizeField(caseData.caseTheory, 500) || "Not specified"}
- Winning Factors: ${sanitizeField(caseData.winningFactors, 500) || "Not specified"}
- Trap Points to Avoid: ${sanitizeField(caseData.trappingFactors, 500) || "Not specified"}

SIMULATION MODE: ${mode}
${modeDescriptions[mode]}

You must respond in JSON format with the following structure:
{
  "introduction": "Brief scene setting for the simulation",
  "openingStatement": "Your opening dialogue as opposing counsel/witness",
  "suggestedResponses": ["Array of 2-3 suggested responses the attorney could use"],
  "warnings": ["Array of 1-2 things to watch out for"],
  "tips": ["Array of 1-2 strategic tips"]
}

Be realistic, professional, and help the attorney practice effectively. Base your responses on the case context provided.`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nBegin the simulation." }] }],
      });

      let responseText = result.text || "";
      
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          res.json(parsed);
        } else {
          res.json({
            introduction: `Trial simulation for ${sanitizeField(caseData.title, 100)} (${mode}) is ready to begin.`,
            openingStatement: responseText.slice(0, 500),
            suggestedResponses: ["Objection, leading the witness.", "I'd like to redirect.", "No further questions."],
            warnings: ["Stay focused on the key facts of the case."],
            tips: ["Use open-ended questions to build your narrative."],
          });
        }
      } catch (parseError) {
        res.json({
          introduction: `Trial simulation for ${sanitizeField(caseData.title, 100)} (${mode}) is ready to begin.`,
          openingStatement: responseText.slice(0, 500) || "Let's begin. I'm ready to proceed with the examination.",
          suggestedResponses: ["Objection, leading the witness.", "I'd like to redirect.", "No further questions."],
          warnings: ["Stay focused on the key facts."],
          tips: ["Speak clearly and confidently."],
        });
      }
    } catch (error) {
      console.error("Error starting trial simulation:", error);
      res.status(500).json({ error: "Failed to start trial simulation" });
    }
  });

  app.post("/api/trial-simulation/respond", async (req: Request, res: Response) => {
    try {
      const { caseId, mode, userStatement, conversationHistory } = req.body;

      if (!caseId || typeof caseId !== "number") {
        return res.status(400).json({ error: "Valid caseId is required" });
      }
      
      if (!mode || !validSimulationModes.includes(mode)) {
        return res.status(400).json({ error: "Valid mode is required" });
      }
      
      if (!userStatement || typeof userStatement !== "string") {
        return res.status(400).json({ error: "userStatement is required" });
      }
      
      const sanitizedStatement = sanitizeField(userStatement, 1000);
      if (!sanitizedStatement.trim()) {
        return res.status(400).json({ error: "userStatement cannot be empty" });
      }

      const caseData = await storage.getCase(caseId);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        httpOptions: {
          apiVersion: "",
          baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
        },
      });

      const modeDescriptions: Record<string, string> = {
        "cross-examination": "You are opposing counsel conducting a cross-examination. Be challenging but professional.",
        "direct-examination": "You are the witness being questioned. Answer naturally based on the case facts.",
        "opening": "You are opposing counsel. Respond to their opening statement with your counter-narrative.",
        "closing": "You are opposing counsel. Counter their closing arguments strategically.",
      };

      const rawHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-10) : [];
      const validHistory = rawHistory.filter((msg: any) => 
        msg && typeof msg === "object" && 
        typeof msg.role === "string" && 
        typeof msg.content === "string" &&
        ["user", "opponent", "coach", "system"].includes(msg.role)
      );
      
      const historyText = validHistory.map((msg: any) => 
        `${msg.role === "user" ? "Attorney" : "Opposing"}: ${sanitizeField(msg.content, 300)}`
      ).join("\n");

      const systemPrompt = `You are an AI legal simulation assistant for trial preparation.

CASE CONTEXT:
- Title: ${sanitizeField(caseData.title, 200)}
- Case Number: ${sanitizeField(caseData.caseNumber, 50) || "N/A"}
- Client: ${sanitizeField(caseData.client, 200)}
- Representation Type: ${sanitizeField(caseData.representationType, 100) || "Plaintiff"}
- Opposing Party: ${sanitizeField(caseData.opposingParty, 200) || "Unknown"}
- Case Theory: ${sanitizeField(caseData.caseTheory, 500) || "Not specified"}
- Winning Factors: ${sanitizeField(caseData.winningFactors, 500) || "Not specified"}
- Trap Points: ${sanitizeField(caseData.trappingFactors, 500) || "Not specified"}

SIMULATION MODE: ${mode}
${modeDescriptions[mode]}

CONVERSATION SO FAR:
${historyText || "(Just started)"}

The attorney just said: "${sanitizedStatement}"

Respond in JSON format:
{
  "opponentResponse": "Your response as opposing counsel/witness (2-4 sentences, conversational)",
  "suggestedResponses": ["2-3 strategic responses the attorney could say next"],
  "warnings": ["1-2 potential pitfalls to avoid"],
  "tips": ["1-2 strategic tips based on what just happened"]
}

Be realistic and help the attorney improve their trial skills. Keep responses concise and natural.`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      });

      let responseText = result.text || "";
      
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          res.json(parsed);
        } else {
          res.json({
            opponentResponse: responseText.slice(0, 300) || "I understand. Please continue.",
            suggestedResponses: ["Could you elaborate on that?", "Let me rephrase the question.", "Moving on to the next point..."],
            warnings: ["Maintain composure and stay focused."],
            tips: ["Build on this response to advance your argument."],
          });
        }
      } catch (parseError) {
        res.json({
          opponentResponse: responseText.slice(0, 300) || "Noted. What's your next question?",
          suggestedResponses: ["Let's explore that further.", "I object to that characterization.", "No further questions on this topic."],
          warnings: ["Stay focused on your case theory."],
          tips: ["Use this moment to transition to your next key point."],
        });
      }
    } catch (error) {
      console.error("Error in trial simulation:", error);
      res.status(500).json({ error: "Failed to process simulation response" });
    }
  });

  // Trial Prep Sessions CRUD
  app.get("/api/cases/:caseId/trial-prep-sessions", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const sessions = await storage.getTrialPrepSessionsByCase(caseId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching trial prep sessions:", error);
      res.status(500).json({ error: "Failed to fetch trial prep sessions" });
    }
  });

  app.get("/api/trial-prep-sessions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getTrialPrepSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching trial prep session:", error);
      res.status(500).json({ error: "Failed to fetch trial prep session" });
    }
  });

  app.post("/api/cases/:caseId/trial-prep-sessions", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const { sessionMode, transcript, allTips, allWarnings, allSuggestedResponses, notes, duration } = req.body;
      
      const session = await storage.createTrialPrepSession({
        caseId,
        sessionMode: sessionMode || "cross-examination",
        transcript: transcript || [],
        allTips: allTips || [],
        allWarnings: allWarnings || [],
        allSuggestedResponses: allSuggestedResponses || [],
        notes: notes || null,
        duration: duration || null,
      });
      
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating trial prep session:", error);
      res.status(500).json({ error: "Failed to create trial prep session" });
    }
  });

  app.patch("/api/trial-prep-sessions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.updateTrialPrepSession(id, req.body);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error updating trial prep session:", error);
      res.status(500).json({ error: "Failed to update trial prep session" });
    }
  });

  app.delete("/api/trial-prep-sessions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTrialPrepSession(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting trial prep session:", error);
      res.status(500).json({ error: "Failed to delete trial prep session" });
    }
  });

  // ==================
  // CASES
  // ==================
  app.get("/api/cases", async (req: Request, res: Response) => {
    try {
      const cases = await storage.getAllCases();
      
      // Get file counts for each case
      const casesWithCounts = await Promise.all(
        cases.map(async (c) => {
          const files = await storage.getDiscoveryFilesByCase(c.id);
          return {
            ...c,
            filesCount: files.length,
            lastActivity: c.updatedAt,
          };
        })
      );

      res.json(casesWithCounts);
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ error: "Failed to fetch cases" });
    }
  });

  app.get("/api/cases/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const caseData = await storage.getCase(id);

      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      const files = await storage.getDiscoveryFilesByCase(id);
      res.json({
        ...caseData,
        filesCount: files.length,
      });
    } catch (error) {
      console.error("Error fetching case:", error);
      res.status(500).json({ error: "Failed to fetch case" });
    }
  });

  app.post("/api/cases", async (req: Request, res: Response) => {
    try {
      const validatedData = caseIntakeSchema.parse(req.body);
      // Add default status for new cases
      const newCase = await storage.createCase({
        ...validatedData,
        status: "active",
      });
      res.status(201).json(newCase);
    } catch (error) {
      console.error("Error creating case:", error);
      res.status(400).json({ error: "Failed to create case" });
    }
  });

  app.patch("/api/cases/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateCase(id, req.body);

      if (!updated) {
        return res.status(404).json({ error: "Case not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating case:", error);
      res.status(400).json({ error: "Failed to update case" });
    }
  });

  app.put("/api/cases/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateCase(id, req.body);

      if (!updated) {
        return res.status(404).json({ error: "Case not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating case:", error);
      res.status(400).json({ error: "Failed to update case" });
    }
  });

  app.delete("/api/cases/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getCase(id);

      if (!existing) {
        return res.status(404).json({ error: "Case not found" });
      }

      await storage.deleteCase(id);
      res.json({ success: true, message: "Case deleted successfully" });
    } catch (error) {
      console.error("Error deleting case:", error);
      res.status(500).json({ error: "Failed to delete case" });
    }
  });

  app.get("/api/cases/:id/export", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const caseData = await storage.getCase(id);

      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      const files = await storage.getDiscoveryFilesByCase(id);
      const timeline = await storage.getTimelineEventsByCase(id);
      const briefs = await storage.getLegalBriefsByCase(id);
      const depositions = await storage.getDepositionPrepByCase(id);

      const exportData = {
        case: caseData,
        discoveryFiles: files,
        timeline,
        legalBriefs: briefs,
        depositionPrep: depositions,
        exportedAt: new Date().toISOString(),
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${caseData.caseNumber}-export.json"`);
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting case:", error);
      res.status(500).json({ error: "Failed to export case" });
    }
  });

  // ==================
  // DISCOVERY FILES
  // ==================
  app.get("/api/cases/:caseId/discovery", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const files = await storage.getDiscoveryFilesByCase(caseId);
      res.json(files);
    } catch (error) {
      console.error("Error fetching discovery files:", error);
      res.status(500).json({ error: "Failed to fetch discovery files" });
    }
  });

  app.post("/api/cases/:caseId/discovery/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const caseId = parseInt(req.params.caseId);
      const file = req.file;
      const { batesStart, batesEnd } = req.body;

      // Fetch case for strategic context
      const caseData = await storage.getCase(caseId);
      let caseContext: CaseContext | undefined;
      
      if (caseData) {
        caseContext = {
          client: caseData.client,
          representationType: caseData.representationType || "plaintiff",
          opposingParty: caseData.opposingParty,
          caseTheory: caseData.caseTheory,
          winningFactors: caseData.winningFactors,
          trappingFactors: caseData.trappingFactors,
          description: caseData.description,
        };
      }

      // Process file based on type with case context for strategic analysis
      let processed;
      const mimeType = file.mimetype;

      if (mimeType === "application/pdf") {
        processed = await processPDF(file.path, file.originalname, caseContext);
      } else if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
        processed = await processMediaFile(file.path, file.originalname, mimeType, caseContext);
      } else if (mimeType.startsWith("image/")) {
        processed = await processImage(file.path, file.originalname, caseContext);
      } else {
        // Generic text processing
        processed = {
          extractedText: "",
          summary: "File uploaded",
          relevance: "medium" as const,
          tags: ["uploaded"],
          extractedDates: [],
          metadata: { mimeType },
        };
      }

      // Save to database with strategic analysis fields
      const discoveryFile = await storage.createDiscoveryFile({
        caseId,
        batesStart: batesStart || `AUTO-${Date.now()}`,
        batesEnd: batesEnd || `AUTO-${Date.now()}`,
        fileName: file.originalname,
        fileType: mimeType,
        filePath: file.path,
        fileSize: file.size,
        relevance: processed.relevance,
        tags: processed.tags,
        summary: processed.summary,
        extractedText: processed.extractedText,
        extractedDates: processed.extractedDates,
        metadata: processed.metadata,
        favorableFindings: processed.favorableFindings,
        adverseFindings: processed.adverseFindings,
        inconsistencies: processed.inconsistencies,
        actionItems: processed.actionItems,
        sourceType: "upload",
      });

      // Notify collaborators about new file
      collaborationService.notifyCaseUpdate(caseId, "discovery", { fileId: discoveryFile.id });

      res.status(201).json(discoveryFile);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to process file" });
    }
  });

  // ==================
  // TIMELINE
  // ==================
  app.get("/api/cases/:caseId/timeline", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const events = await storage.getTimelineEventsByCase(caseId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching timeline:", error);
      res.status(500).json({ error: "Failed to fetch timeline" });
    }
  });

  app.post("/api/cases/:caseId/timeline/generate", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);

      // Generate timeline using AI
      const events = await generateTimelineFromDocuments(caseId);

      // Save events to database
      const savedEvents = await Promise.all(
        events.map((event) =>
          storage.createTimelineEvent({
            caseId,
            eventDate: new Date(event.eventDate),
            title: event.title,
            description: event.description,
            eventType: event.eventType,
            linkedBates: event.linkedBates,
            metadata: {},
          })
        )
      );

      // Notify collaborators about timeline update
      collaborationService.notifyCaseUpdate(caseId, "timeline", { count: savedEvents.length });

      res.json(savedEvents);
    } catch (error) {
      console.error("Error generating timeline:", error);
      res.status(500).json({ error: "Failed to generate timeline" });
    }
  });

  // ==================
  // DEPOSITION PREP
  // ==================
  app.get("/api/cases/:caseId/deposition", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const preps = await storage.getDepositionPrepByCase(caseId);
      res.json(preps);
    } catch (error) {
      console.error("Error fetching deposition prep:", error);
      res.status(500).json({ error: "Failed to fetch deposition prep" });
    }
  });

  app.post("/api/cases/:caseId/deposition/generate", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const { witnessName, depositionType } = req.body;

      if (!witnessName || !depositionType) {
        return res.status(400).json({ error: "witnessName and depositionType required" });
      }

      // Generate questions using AI
      const result = await generateDepositionQuestions(caseId, witnessName, depositionType);

      // Save to database
      const prep = await storage.createDepositionPrep({
        caseId,
        depositionType,
        targetWitness: witnessName,
        questions: result.questions,
        strategy: result.strategy,
        linkedEvidence: result.questions.flatMap((q) => q.linkedBates || []),
      });

      // Notify collaborators about deposition prep
      collaborationService.notifyCaseUpdate(caseId, "deposition", { prepId: prep.id });

      res.json(prep);
    } catch (error) {
      console.error("Error generating deposition prep:", error);
      res.status(500).json({ error: "Failed to generate deposition prep" });
    }
  });

  // ==================
  // SUGGESTED FILINGS
  // ==================
  app.get("/api/cases/:caseId/filings", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const filings = await storage.getSuggestedFilingsByCase(caseId);
      res.json(filings);
    } catch (error) {
      console.error("Error fetching filings:", error);
      res.status(500).json({ error: "Failed to fetch filings" });
    }
  });

  app.post("/api/cases/:caseId/filings/generate", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);

      // Generate filing suggestions using AI
      const suggestions = await suggestNextFilings(caseId);

      // Save to database
      const savedFilings = await Promise.all(
        suggestions.map((filing) =>
          storage.createSuggestedFiling({
            caseId,
            filingType: filing.filingType,
            title: filing.title,
            description: filing.description,
            deadline: filing.deadline ? new Date(filing.deadline) : null,
            priority: filing.priority,
            reasoning: filing.reasoning,
            status: "pending",
          })
        )
      );

      res.json(savedFilings);
    } catch (error) {
      console.error("Error generating filings:", error);
      res.status(500).json({ error: "Failed to generate filing suggestions" });
    }
  });

  // ==================
  // GOOGLE DRIVE INTEGRATION
  // ==================

  // List Google Drive folders
  app.get("/api/drive/folders", async (req: Request, res: Response) => {
    try {
      const parentId = req.query.parentId as string | undefined;
      const folders = await listFolders(parentId);
      res.json(folders);
    } catch (error: any) {
      console.error("Error listing Drive folders:", error);
      if (error.message?.includes("not connected")) {
        return res.status(401).json({ error: "Google Drive not connected" });
      }
      res.status(500).json({ error: "Failed to list folders" });
    }
  });

  // Get cloud folders linked to a case
  app.get("/api/cases/:caseId/cloud-folders", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const folders = await storage.getCloudFoldersByCase(caseId);
      res.json(folders);
    } catch (error) {
      console.error("Error fetching cloud folders:", error);
      res.status(500).json({ error: "Failed to fetch cloud folders" });
    }
  });

  // Link a Google Drive folder to a case
  app.post("/api/cases/:caseId/cloud-folders", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const { folderId, folderName, batesPrefix } = req.body;

      if (!folderId || !folderName || !batesPrefix) {
        return res.status(400).json({ error: "folderId, folderName, and batesPrefix are required" });
      }

      const cloudFolder = await storage.createCloudFolder({
        caseId,
        provider: "google_drive",
        folderId,
        folderName,
        batesPrefix,
        nextBatesNumber: 1,
      });

      res.status(201).json(cloudFolder);
    } catch (error) {
      console.error("Error linking cloud folder:", error);
      res.status(500).json({ error: "Failed to link cloud folder" });
    }
  });

  // Sync a cloud folder - imports all files with Bates numbers
  app.post("/api/cloud-folders/:folderId/sync", async (req: Request, res: Response) => {
    try {
      const folderId = parseInt(req.params.folderId);
      const cloudFolder = await storage.getCloudFolder(folderId);

      if (!cloudFolder) {
        return res.status(404).json({ error: "Cloud folder not found" });
      }

      // List all files in the Google Drive folder
      const driveFiles = await listFilesInFolder(cloudFolder.folderId);

      const importedFiles: any[] = [];
      let batesCounter = cloudFolder.nextBatesNumber;

      for (const driveFile of driveFiles) {
        // Check if file already imported
        const existingFile = await storage.getDiscoveryFileByCloudId(driveFile.id);
        if (existingFile) {
          importedFiles.push(existingFile);
          continue;
        }

        // Generate Bates number
        const batesNumber = `${cloudFolder.batesPrefix}-${String(batesCounter).padStart(5, "0")}`;
        batesCounter++;

        // Determine file type category
        let fileCategory = "document";
        if (driveFile.mimeType.startsWith("image/")) fileCategory = "image";
        if (driveFile.mimeType.startsWith("video/")) fileCategory = "video";
        if (driveFile.mimeType.startsWith("audio/")) fileCategory = "audio";
        if (driveFile.mimeType === "application/pdf") fileCategory = "pdf";

        // Create discovery file entry (reference only - no local file storage)
        const discoveryFile = await storage.createDiscoveryFile({
          caseId: cloudFolder.caseId,
          batesStart: batesNumber,
          batesEnd: batesNumber,
          fileName: driveFile.name,
          fileType: driveFile.mimeType,
          filePath: null,
          fileSize: driveFile.size ? parseInt(driveFile.size) : null,
          relevance: "medium",
          tags: ["cloud-import", fileCategory],
          summary: `Imported from Google Drive: ${driveFile.name}`,
          extractedText: null,
          extractedDates: null,
          metadata: {
            cloudFileId: driveFile.id,
            cloudProvider: "google_drive",
            originalName: driveFile.name,
            createdTime: driveFile.createdTime,
            modifiedTime: driveFile.modifiedTime,
          },
          sourceType: "cloud",
          cloudFileId: driveFile.id,
          cloudProvider: "google_drive",
          driveUrl: driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
        });

        importedFiles.push(discoveryFile);
      }

      // Update the cloud folder's next Bates number
      await storage.updateCloudFolder(folderId, {
        nextBatesNumber: batesCounter,
      });

      res.json({
        message: `Synced ${importedFiles.length} files`,
        files: importedFiles,
        nextBatesNumber: batesCounter,
      });
    } catch (error: any) {
      console.error("Error syncing cloud folder:", error);
      if (error.message?.includes("not connected")) {
        return res.status(401).json({ error: "Google Drive not connected" });
      }
      res.status(500).json({ error: "Failed to sync cloud folder" });
    }
  });

  // Delete a cloud folder link
  app.delete("/api/cloud-folders/:folderId", async (req: Request, res: Response) => {
    try {
      const folderId = parseInt(req.params.folderId);
      await storage.deleteCloudFolder(folderId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting cloud folder:", error);
      res.status(500).json({ error: "Failed to delete cloud folder" });
    }
  });

  // ==================
  // NEWS ARTICLES
  // ==================
  const { getLatestNews, getFeaturedNews, fetchAndCacheNews } = await import("./services/newsAggregator");

  app.get("/api/news/latest", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 3;
      const articles = await getLatestNews(limit);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching latest news:", error);
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  app.get("/api/news/featured", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 2;
      const articles = await getFeaturedNews(limit);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching featured news:", error);
      res.status(500).json({ error: "Failed to fetch featured news" });
    }
  });

  app.post("/api/news/refresh", async (req: Request, res: Response) => {
    try {
      await fetchAndCacheNews();
      res.json({ success: true, message: "News refreshed" });
    } catch (error) {
      console.error("Error refreshing news:", error);
      res.status(500).json({ error: "Failed to refresh news" });
    }
  });

  // ==================
  // LEGAL BRIEFS
  // ==================
  const { generateLegalBrief, getBriefTypes } = await import("./services/briefGenerator");

  app.get("/api/cases/:caseId/briefs", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const briefs = await storage.getLegalBriefsByCase(caseId);
      res.json(briefs);
    } catch (error) {
      console.error("Error fetching legal briefs:", error);
      res.status(500).json({ error: "Failed to fetch legal briefs" });
    }
  });

  app.get("/api/briefs/types", async (req: Request, res: Response) => {
    try {
      const types = getBriefTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching brief types:", error);
      res.status(500).json({ error: "Failed to fetch brief types" });
    }
  });

  app.get("/api/briefs/:briefId", async (req: Request, res: Response) => {
    try {
      const briefId = parseInt(req.params.briefId);
      const brief = await storage.getLegalBrief(briefId);
      if (!brief) {
        return res.status(404).json({ error: "Brief not found" });
      }
      res.json(brief);
    } catch (error) {
      console.error("Error fetching legal brief:", error);
      res.status(500).json({ error: "Failed to fetch legal brief" });
    }
  });

  app.post("/api/cases/:caseId/briefs/generate", async (req: Request, res: Response) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const { briefType, title, additionalInstructions } = req.body;
      
      if (!briefType || !title) {
        return res.status(400).json({ error: "Brief type and title are required" });
      }

      const brief = await generateLegalBrief({
        caseId,
        briefType,
        title,
        additionalInstructions,
      });

      // Notify collaborators about new brief
      collaborationService.notifyCaseUpdate(caseId, "briefs", { briefId: brief.id });

      res.json(brief);
    } catch (error) {
      console.error("Error generating legal brief:", error);
      res.status(500).json({ error: "Failed to generate legal brief" });
    }
  });

  app.put("/api/briefs/:briefId", async (req: Request, res: Response) => {
    try {
      const briefId = parseInt(req.params.briefId);
      const { content, title, status } = req.body;
      
      const updated = await storage.updateLegalBrief(briefId, {
        content,
        title,
        status,
      });

      if (!updated) {
        return res.status(404).json({ error: "Brief not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating legal brief:", error);
      res.status(500).json({ error: "Failed to update legal brief" });
    }
  });

  app.delete("/api/briefs/:briefId", async (req: Request, res: Response) => {
    try {
      const briefId = parseInt(req.params.briefId);
      await storage.deleteLegalBrief(briefId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting legal brief:", error);
      res.status(500).json({ error: "Failed to delete legal brief" });
    }
  });

  return httpServer;
}
