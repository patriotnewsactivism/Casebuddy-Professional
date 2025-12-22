import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import type { LegalBrief, DiscoveryFile, TimelineEvent } from "@shared/schema";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

interface BriefGenerationRequest {
  caseId: number;
  briefType: string;
  title: string;
  additionalInstructions?: string;
}

interface GeneratedBrief {
  content: string;
  summary: string;
  precedents: Array<{
    caseName: string;
    citation: string;
    relevance: string;
  }>;
  keyArguments: string[];
}

const BRIEF_TYPES: Record<string, string> = {
  "motion_dismiss": "Motion to Dismiss",
  "motion_summary": "Motion for Summary Judgment",
  "motion_suppress": "Motion to Suppress Evidence",
  "response_motion": "Response to Motion",
  "trial_brief": "Trial Brief",
  "appellate_brief": "Appellate Brief",
  "memorandum_law": "Memorandum of Law",
  "complaint": "Complaint",
  "answer": "Answer to Complaint",
};

async function getCaseFacts(caseId: number): Promise<{
  discoveryFiles: DiscoveryFile[];
  timelineEvents: TimelineEvent[];
  caseInfo: any;
}> {
  const [discoveryFiles, timelineEvents, caseInfo] = await Promise.all([
    storage.getDiscoveryFilesByCase(caseId),
    storage.getTimelineEventsByCase(caseId),
    storage.getCase(caseId),
  ]);

  return { discoveryFiles, timelineEvents, caseInfo };
}

function buildContextFromFacts(facts: {
  discoveryFiles: DiscoveryFile[];
  timelineEvents: TimelineEvent[];
  caseInfo: any;
}): string {
  const { discoveryFiles, timelineEvents, caseInfo } = facts;

  let context = `CASE INFORMATION:\n`;
  if (caseInfo) {
    context += `Case Title: ${caseInfo.title}\n`;
    context += `Case Number: ${caseInfo.caseNumber}\n`;
    context += `Client: ${caseInfo.client}\n`;
    context += `Description: ${caseInfo.description || "N/A"}\n\n`;
  }

  if (timelineEvents.length > 0) {
    context += `KEY TIMELINE EVENTS:\n`;
    timelineEvents.forEach((event) => {
      context += `- ${new Date(event.eventDate).toLocaleDateString()}: ${event.title}\n`;
      if (event.description) context += `  ${event.description}\n`;
    });
    context += "\n";
  }

  if (discoveryFiles.length > 0) {
    context += `DISCOVERY DOCUMENTS (${discoveryFiles.length} files):\n`;
    discoveryFiles.slice(0, 20).forEach((file) => {
      context += `- [${file.batesStart}] ${file.fileName}`;
      if (file.summary) context += `: ${file.summary.substring(0, 200)}...`;
      context += "\n";
    });
    context += "\n";
  }

  return context;
}

export async function generateLegalBrief(
  request: BriefGenerationRequest
): Promise<LegalBrief> {
  const { caseId, briefType, title, additionalInstructions } = request;

  const facts = await getCaseFacts(caseId);
  const factContext = buildContextFromFacts(facts);
  const briefTypeName = BRIEF_TYPES[briefType] || briefType;

  const prompt = `You are an expert legal brief writer with extensive experience in litigation. Generate a comprehensive ${briefTypeName} based on the following case information.

${factContext}

BRIEF REQUIREMENTS:
- Title: ${title}
- Type: ${briefTypeName}
${additionalInstructions ? `- Additional Instructions: ${additionalInstructions}` : ""}

INSTRUCTIONS:
1. Generate a professional legal brief that follows standard legal writing conventions
2. Include proper legal citations and references to relevant case law
3. Structure the brief with clear sections (Introduction, Statement of Facts, Legal Argument, Conclusion)
4. Reference specific evidence from the discovery documents using Bates numbers where applicable
5. Identify and cite relevant legal precedents that support the arguments
6. Provide compelling legal reasoning

RESPONSE FORMAT:
Provide your response in the following JSON structure:
{
  "content": "The full text of the legal brief with proper formatting and sections",
  "summary": "A 2-3 sentence executive summary of the brief's main arguments",
  "precedents": [
    {
      "caseName": "Case name",
      "citation": "Citation format",
      "relevance": "Brief explanation of relevance"
    }
  ],
  "keyArguments": ["Main argument 1", "Main argument 2", "Main argument 3"]
}

Generate the ${briefTypeName} now:`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    let generatedBrief: GeneratedBrief;
    
    try {
      const responseText = response.text || "";
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedBrief = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      generatedBrief = {
        content: response.text || "Unable to generate brief content.",
        summary: "Brief generated based on case facts and legal precedents.",
        precedents: [],
        keyArguments: [],
      };
    }

    const savedBrief = await storage.createLegalBrief({
      caseId,
      title,
      briefType,
      content: generatedBrief.content,
      summary: generatedBrief.summary,
      precedents: generatedBrief.precedents,
      keyArguments: generatedBrief.keyArguments,
      status: "draft",
    });

    return savedBrief;
  } catch (error) {
    console.error("[BriefGenerator] Error generating brief:", error);
    throw new Error("Failed to generate legal brief");
  }
}

export function getBriefTypes(): Record<string, string> {
  return BRIEF_TYPES;
}
