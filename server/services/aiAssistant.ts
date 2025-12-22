import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

/**
 * Generate deposition questions based on case evidence
 */
export async function generateDepositionQuestions(
  caseId: number,
  witnessName: string,
  depositionType: "direct" | "cross"
): Promise<{
  questions: Array<{ question: string; purpose: string; linkedBates: string[] }>;
  strategy: string;
}> {
  // Get all discovery files for context
  const files = await storage.getDiscoveryFilesByCase(caseId);
  const timeline = await storage.getTimelineEventsByCase(caseId);

  const context = `
Case Evidence Summary:
${files.slice(0, 10).map(f => `- ${f.batesStart}: ${f.summary || f.fileName}`).join("\n")}

Timeline:
${timeline.slice(0, 5).map(e => `- ${e.eventDate}: ${e.title}`).join("\n")}
`;

  const prompt = `You are an expert trial attorney. Generate strategic ${depositionType} examination questions for ${witnessName}.

${context}

Provide:
1. 8-12 strategic questions designed to ${depositionType === "direct" ? "establish facts and credibility" : "expose inconsistencies and weaken testimony"}
2. For each question, explain its strategic purpose
3. Link to relevant Bates numbers when applicable
4. Overall examination strategy

Respond in JSON:
{
  "strategy": "Overall approach...",
  "questions": [
    {
      "question": "...",
      "purpose": "...",
      "linkedBates": ["BATES-001"]
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const resultText = response.text || "{}";
  const jsonMatch = resultText.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { questions: [], strategy: "" };

  return result;
}

/**
 * Generate timeline from all case documents
 */
export async function generateTimelineFromDocuments(caseId: number): Promise<
  Array<{
    eventDate: string;
    title: string;
    description: string;
    eventType: string;
    linkedBates: string[];
  }>
> {
  const files = await storage.getDiscoveryFilesByCase(caseId);

  const evidenceSummary = files
    .map(f => `${f.batesStart}: ${f.summary || f.fileName} (${f.extractedDates ? JSON.stringify(f.extractedDates) : "no dates"})`)
    .join("\n");

  const prompt = `Based on this evidence, create a chronological timeline of key events in the case.

Evidence:
${evidenceSummary}

Extract and organize ALL significant dates and events. Respond in JSON:
{
  "events": [
    {
      "eventDate": "YYYY-MM-DD",
      "title": "Brief title",
      "description": "What happened",
      "eventType": "evidence|court|meeting|communication",
      "linkedBates": ["BATES-001"]
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const resultText = response.text || "{}";
  const jsonMatch = resultText.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { events: [] };

  return result.events || [];
}

/**
 * Suggest next legal filings based on case state
 */
export async function suggestNextFilings(caseId: number): Promise<
  Array<{
    filingType: string;
    title: string;
    description: string;
    deadline: string | null;
    priority: "high" | "medium" | "low";
    reasoning: string;
  }>
> {
  const caseData = await storage.getCase(caseId);
  const files = await storage.getDiscoveryFilesByCase(caseId);
  const timeline = await storage.getTimelineEventsByCase(caseId);

  const prompt = `You are a legal strategist. Based on this case state, suggest the next 3-5 strategic filings/motions.

Case: ${caseData?.title}
Status: ${caseData?.status}
Evidence count: ${files.length}
Next deadline: ${caseData?.nextDeadline}

Recent timeline:
${timeline.slice(0, 5).map(e => `- ${e.eventDate}: ${e.title}`).join("\n")}

Suggest filings in JSON:
{
  "filings": [
    {
      "filingType": "Motion to...|Discovery Request|...",
      "title": "...",
      "description": "What this achieves",
      "deadline": "YYYY-MM-DD or null",
      "priority": "high|medium|low",
      "reasoning": "Why file this now"
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const resultText = response.text || "{}";
  const jsonMatch = resultText.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { filings: [] };

  return result.filings || [];
}
