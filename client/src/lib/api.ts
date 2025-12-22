import type { Case, DiscoveryFile, TimelineEvent, DepositionPrep, SuggestedFiling, CloudFolder } from "@shared/schema";

const API_BASE = "/api";

// Cases
export async function getCases(): Promise<(Case & { filesCount: number; lastActivity: Date })[]> {
  const res = await fetch(`${API_BASE}/cases`);
  if (!res.ok) throw new Error("Failed to fetch cases");
  return res.json();
}

export async function getCase(id: string): Promise<Case & { filesCount: number }> {
  const res = await fetch(`${API_BASE}/cases/${id}`);
  if (!res.ok) throw new Error("Failed to fetch case");
  return res.json();
}

export async function createCase(data: {
  title: string;
  caseNumber: string;
  client: string;
  description?: string;
}): Promise<Case> {
  const res = await fetch(`${API_BASE}/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create case");
  return res.json();
}

// Discovery Files
export async function getDiscoveryFiles(caseId: string): Promise<DiscoveryFile[]> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/discovery`);
  if (!res.ok) throw new Error("Failed to fetch discovery files");
  return res.json();
}

export async function uploadDiscoveryFile(
  caseId: string,
  file: File,
  batesStart?: string,
  batesEnd?: string
): Promise<DiscoveryFile> {
  const formData = new FormData();
  formData.append("file", file);
  if (batesStart) formData.append("batesStart", batesStart);
  if (batesEnd) formData.append("batesEnd", batesEnd);

  const res = await fetch(`${API_BASE}/cases/${caseId}/discovery/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Failed to upload file");
  return res.json();
}

// Timeline
export async function getTimeline(caseId: string): Promise<TimelineEvent[]> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/timeline`);
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

export async function generateTimeline(caseId: string): Promise<TimelineEvent[]> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/timeline/generate`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to generate timeline");
  return res.json();
}

// Deposition Prep
export async function getDepositionPrep(caseId: string): Promise<DepositionPrep[]> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/deposition`);
  if (!res.ok) throw new Error("Failed to fetch deposition prep");
  return res.json();
}

export async function generateDepositionQuestions(
  caseId: string,
  witnessName: string,
  depositionType: "direct" | "cross"
): Promise<DepositionPrep> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/deposition/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ witnessName, depositionType }),
  });
  if (!res.ok) throw new Error("Failed to generate deposition prep");
  return res.json();
}

// Suggested Filings
export async function getSuggestedFilings(caseId: string): Promise<SuggestedFiling[]> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/filings`);
  if (!res.ok) throw new Error("Failed to fetch filings");
  return res.json();
}

export async function generateSuggestedFilings(caseId: string): Promise<SuggestedFiling[]> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/filings/generate`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to generate filing suggestions");
  return res.json();
}

// Google Drive Integration
export interface DriveFolder {
  id: string;
  name: string;
}

export async function getDriveFolders(parentId?: string): Promise<DriveFolder[]> {
  const url = parentId 
    ? `${API_BASE}/drive/folders?parentId=${encodeURIComponent(parentId)}`
    : `${API_BASE}/drive/folders`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) throw new Error("Google Drive not connected");
    throw new Error("Failed to fetch Drive folders");
  }
  return res.json();
}

export async function getCloudFolders(caseId: string): Promise<CloudFolder[]> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/cloud-folders`);
  if (!res.ok) throw new Error("Failed to fetch cloud folders");
  return res.json();
}

export async function linkCloudFolder(
  caseId: string,
  folderId: string,
  folderName: string,
  batesPrefix: string
): Promise<CloudFolder> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/cloud-folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderId, folderName, batesPrefix }),
  });
  if (!res.ok) throw new Error("Failed to link cloud folder");
  return res.json();
}

export async function syncCloudFolder(folderId: number): Promise<{ message: string; files: DiscoveryFile[] }> {
  const res = await fetch(`${API_BASE}/cloud-folders/${folderId}/sync`, {
    method: "POST",
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Google Drive not connected");
    throw new Error("Failed to sync cloud folder");
  }
  return res.json();
}

export async function deleteCloudFolder(folderId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/cloud-folders/${folderId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete cloud folder");
}

// News Articles
export interface NewsArticle {
  id: number;
  url: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  featured: boolean;
  source: string;
}

export async function getLatestNews(limit: number = 3): Promise<NewsArticle[]> {
  const res = await fetch(`${API_BASE}/news/latest?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch news");
  return res.json();
}

export async function getFeaturedNews(limit: number = 2): Promise<NewsArticle[]> {
  const res = await fetch(`${API_BASE}/news/featured?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch featured news");
  return res.json();
}

// Legal Briefs
export interface LegalBrief {
  id: number;
  caseId: number;
  title: string;
  briefType: string;
  content: string;
  summary: string | null;
  precedents: Array<{ caseName: string; citation: string; relevance: string }> | null;
  keyArguments: string[] | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function getLegalBriefs(caseId: string): Promise<LegalBrief[]> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/briefs`);
  if (!res.ok) throw new Error("Failed to fetch legal briefs");
  return res.json();
}

export async function getBriefTypes(): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/briefs/types`);
  if (!res.ok) throw new Error("Failed to fetch brief types");
  return res.json();
}

export async function getLegalBrief(briefId: number): Promise<LegalBrief> {
  const res = await fetch(`${API_BASE}/briefs/${briefId}`);
  if (!res.ok) throw new Error("Failed to fetch legal brief");
  return res.json();
}

export async function generateLegalBrief(
  caseId: string,
  briefType: string,
  title: string,
  additionalInstructions?: string
): Promise<LegalBrief> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/briefs/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ briefType, title, additionalInstructions }),
  });
  if (!res.ok) throw new Error("Failed to generate legal brief");
  return res.json();
}

export async function updateLegalBrief(
  briefId: number,
  data: { content?: string; title?: string; status?: string }
): Promise<LegalBrief> {
  const res = await fetch(`${API_BASE}/briefs/${briefId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update legal brief");
  return res.json();
}

export async function deleteLegalBrief(briefId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/briefs/${briefId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete legal brief");
}

// AI Chat Conversations
export interface Conversation {
  id: number;
  caseId: number | null;
  title: string;
  createdAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
}

export async function getConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API_BASE}/conversations`);
  if (!res.ok) throw new Error("Failed to fetch conversations");
  return res.json();
}

export async function getConversation(id: number): Promise<Conversation & { messages: Message[] }> {
  const res = await fetch(`${API_BASE}/conversations/${id}`);
  if (!res.ok) throw new Error("Failed to fetch conversation");
  return res.json();
}

export async function createConversation(title: string, caseId?: number): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, caseId }),
  });
  if (!res.ok) throw new Error("Failed to create conversation");
  return res.json();
}

export async function deleteConversation(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/conversations/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete conversation");
}

export async function sendChatMessage(
  conversationId: number, 
  content: string,
  onChunk: (text: string) => void
): Promise<void> {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) throw new Error("Failed to send message");

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.content) {
            onChunk(data.content);
          }
        } catch {}
      }
    }
  }
}

// Case Management
export async function updateCase(
  id: string,
  data: { title?: string; description?: string; status?: string; nextDeadline?: string | null }
): Promise<Case> {
  const res = await fetch(`${API_BASE}/cases/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update case");
  return res.json();
}

export async function deleteCase(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/cases/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete case");
}

// Export Case Data
export async function exportCaseData(caseId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/export`);
  if (!res.ok) throw new Error("Failed to export case data");
  return res.blob();
}
