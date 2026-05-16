export interface DriveDocumentFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
}

export interface DocAnalysisSection {
  title: string;
  body: string;
}

export interface DocAnalysisResult {
  executiveSummary: string;
  risks: DocAnalysisSection[];
  actions: DocAnalysisSection[];
  criticalQuestions: string[];
  draftResponse: string;
}

export interface DocumentAnalysisRecord {
  id: string;
  fileName: string;
  mimeType: string;
  source: "drive" | "upload";
  fileId: string | null;
  summary: DocAnalysisResult;
  createdAt: string;
}

export interface UploadedDocumentInput {
  fileName: string;
  mimeType: string;
  base64: string;
}
