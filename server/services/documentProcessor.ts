import { GoogleGenAI } from "@google/genai";
import * as pdfParseModule from "pdf-parse";
import fs from "fs/promises";
import path from "path";

const pdfParse = (pdfParseModule as any).default || pdfParseModule;

// Using Replit AI Integrations for Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

export interface ProcessedDocument {
  extractedText: string;
  summary: string;
  relevance: "high" | "medium" | "low";
  tags: string[];
  extractedDates: Array<{ date: string; context: string }>;
  metadata: Record<string, any>;
  // Strategic analysis fields
  favorableFindings?: string[];
  adverseFindings?: string[];
  inconsistencies?: string[];
  actionItems?: string[];
}

export interface CaseContext {
  client: string;
  representationType: string; // plaintiff, defendant, petitioner, respondent
  opposingParty?: string | null;
  caseTheory?: string | null;
  winningFactors?: string | null;
  trappingFactors?: string | null;
  description?: string | null;
}

/**
 * Build case context string for AI prompts
 */
function buildCaseContextPrompt(caseContext?: CaseContext): string {
  if (!caseContext) return "";
  
  const parts: string[] = [];
  parts.push(`\n## CASE CONTEXT - CRITICAL FOR ANALYSIS`);
  parts.push(`We represent the ${caseContext.representationType.toUpperCase()}: ${caseContext.client}`);
  
  if (caseContext.opposingParty) {
    parts.push(`Opposing party: ${caseContext.opposingParty}`);
  }
  
  if (caseContext.description) {
    parts.push(`Case overview: ${caseContext.description}`);
  }
  
  if (caseContext.caseTheory) {
    parts.push(`Our theory of the case: ${caseContext.caseTheory}`);
  }
  
  if (caseContext.winningFactors) {
    parts.push(`Evidence we're looking for to WIN: ${caseContext.winningFactors}`);
  }
  
  if (caseContext.trappingFactors) {
    parts.push(`Inconsistencies to TRAP the other side: ${caseContext.trappingFactors}`);
  }
  
  return parts.join("\n");
}

/**
 * Process a PDF document using Gemini OCR and analysis
 */
export async function processPDF(filePath: string, fileName: string, caseContext?: CaseContext): Promise<ProcessedDocument> {
  try {
    // First try pdf-parse for text extraction
    const dataBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text;

    const contextPrompt = buildCaseContextPrompt(caseContext);
    
    // Use Gemini to analyze the document with case context
    const analysisPrompt = `You are an elite legal document analyzer working for a law firm. Your job is to find evidence that helps WIN the case and identify INCONSISTENCIES that can trap the opposing side.
${contextPrompt}

## DOCUMENT TO ANALYZE
File: ${fileName}
Document text:
${extractedText.substring(0, 10000)}

## YOUR ANALYSIS TASK
Analyze this document strategically from our client's perspective. Provide:

1. SUMMARY: Concise summary (2-3 sentences)
2. RELEVANCE: Rate high/medium/low based on how critical this is for our case
3. TAGS: Key categories (financial, communication, evidence, witness-statement, contract, medical, etc.)
4. DATES: Extract dates with context
5. FAVORABLE FINDINGS: What in this document HELPS our client's case? What can we use?
6. ADVERSE FINDINGS: What in this document could HURT our case? What do we need to address?
7. INCONSISTENCIES: Any contradictions, timeline gaps, or statements that conflict with known facts?
8. ACTION ITEMS: What should the attorney do with this document?

Respond in JSON:
{
  "summary": "...",
  "relevance": "high|medium|low",
  "tags": ["tag1", "tag2"],
  "dates": [{"date": "YYYY-MM-DD", "context": "what happened"}],
  "favorableFindings": ["finding 1", "finding 2"],
  "adverseFindings": ["finding 1"],
  "inconsistencies": ["inconsistency 1"],
  "actionItems": ["action 1", "action 2"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: analysisPrompt }] }],
    });

    const resultText = response.text || "{}";
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      extractedText: extractedText.substring(0, 50000), // Limit storage
      summary: analysis.summary || "Document processed",
      relevance: analysis.relevance || "medium",
      tags: analysis.tags || [],
      extractedDates: analysis.dates || [],
      favorableFindings: analysis.favorableFindings || [],
      adverseFindings: analysis.adverseFindings || [],
      inconsistencies: analysis.inconsistencies || [],
      actionItems: analysis.actionItems || [],
      metadata: {
        pageCount: pdfData.numpages,
        fileName,
      },
    };
  } catch (error) {
    console.error("PDF processing error:", error);
    throw new Error("Failed to process PDF");
  }
}

/**
 * Process audio/video using Gemini's multimodal capabilities
 */
export async function processMediaFile(
  filePath: string,
  fileName: string,
  mimeType: string,
  caseContext?: CaseContext
): Promise<ProcessedDocument> {
  try {
    const fileData = await fs.readFile(filePath);
    const base64Data = fileData.toString("base64");
    const contextPrompt = buildCaseContextPrompt(caseContext);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            {
              text: `You are an elite legal analyst. Transcribe and analyze this ${mimeType.includes("audio") ? "audio" : "video"} file strategically.
${contextPrompt}

Provide:
1. Full transcription (word for word)
2. Summary of key points
3. Any dates or times mentioned
4. Relevance to our case (high/medium/low)
5. Tags describing the content
6. FAVORABLE FINDINGS: What helps our client's case?
7. ADVERSE FINDINGS: What could hurt our case?
8. INCONSISTENCIES: Any contradictions or suspicious statements?
9. ACTION ITEMS: What should the attorney do?

Respond in JSON:
{
  "transcription": "...",
  "summary": "...",
  "relevance": "high|medium|low",
  "tags": ["tag1", "tag2"],
  "dates": [{"date": "YYYY-MM-DD", "context": "..."}],
  "favorableFindings": ["..."],
  "adverseFindings": ["..."],
  "inconsistencies": ["..."],
  "actionItems": ["..."]
}`,
            },
          ],
        },
      ],
    });

    const resultText = response.text || "{}";
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      extractedText: analysis.transcription || "",
      summary: analysis.summary || "Media file processed",
      relevance: analysis.relevance || "medium",
      tags: analysis.tags || ["media", mimeType.includes("audio") ? "audio" : "video"],
      extractedDates: analysis.dates || [],
      favorableFindings: analysis.favorableFindings || [],
      adverseFindings: analysis.adverseFindings || [],
      inconsistencies: analysis.inconsistencies || [],
      actionItems: analysis.actionItems || [],
      metadata: {
        mimeType,
        fileName,
      },
    };
  } catch (error) {
    console.error("Media processing error:", error);
    throw new Error("Failed to process media file");
  }
}

/**
 * Process image files using Gemini vision
 */
export async function processImage(filePath: string, fileName: string, caseContext?: CaseContext): Promise<ProcessedDocument> {
  try {
    const fileData = await fs.readFile(filePath);
    const base64Data = fileData.toString("base64");
    const contextPrompt = buildCaseContextPrompt(caseContext);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: "image/jpeg",
              },
            },
            {
              text: `You are an elite legal analyst. Analyze this image strategically for our case.
${contextPrompt}

Extract any text (OCR), describe what's shown, and provide:
1. Extracted text (if any)
2. Description of the image
3. Relevance to our case (high/medium/low)
4. Any dates visible
5. Tags
6. FAVORABLE FINDINGS: What helps our client?
7. ADVERSE FINDINGS: What could hurt us?
8. INCONSISTENCIES: Any problems with this evidence?
9. ACTION ITEMS: What should the attorney do?

JSON format:
{
  "extractedText": "...",
  "summary": "...",
  "relevance": "high|medium|low",
  "tags": ["tag1"],
  "dates": [{"date": "YYYY-MM-DD", "context": "..."}],
  "favorableFindings": ["..."],
  "adverseFindings": ["..."],
  "inconsistencies": ["..."],
  "actionItems": ["..."]
}`,
            },
          ],
        },
      ],
    });

    const resultText = response.text || "{}";
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      extractedText: analysis.extractedText || "",
      summary: analysis.summary || "Image processed",
      relevance: analysis.relevance || "medium",
      tags: analysis.tags || ["image"],
      extractedDates: analysis.dates || [],
      favorableFindings: analysis.favorableFindings || [],
      adverseFindings: analysis.adverseFindings || [],
      inconsistencies: analysis.inconsistencies || [],
      actionItems: analysis.actionItems || [],
      metadata: {
        fileName,
      },
    };
  } catch (error) {
    console.error("Image processing error:", error);
    throw new Error("Failed to process image");
  }
}
