import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import type {
  DocAnalysisResult,
  DocumentAnalysisRecord,
  DriveDocumentFile,
  UploadedDocumentInput,
} from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { driveReadFileText, driveRecent, driveSearch } from "../integrations/google-api.js";
import { tryEnsureFreshAccessToken } from "../integrations/token-manager.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const DOC_SYSTEM = `Voce e o O.R.I.O.N. no modulo DOCS.
Analise documentos com rigor executivo. Responda apenas JSON puro:
{
  "executiveSummary": "resumo em 4-8 linhas",
  "risks": [{"title":"risco", "body":"impacto e motivo"}],
  "actions": [{"title":"acao", "body":"proximo passo concreto"}],
  "criticalQuestions": ["pergunta critica"],
  "draftResponse": "rascunho de resposta ou continuacao util"
}
Regras: nao invente clausulas ausentes; marque incertezas; destaque riscos legais/financeiros sem dar aconselhamento juridico definitivo.`;

interface UserWithDrive {
  integrations: Array<{
    provider: "gmail" | "gcal" | "gdrive" | "notion" | "slack" | "spotify" | "booking";
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    scopes: string[];
    status: "connected" | "expired" | "revoked" | "error";
    id: string;
    userId: string;
    mcpUrl: string;
    connectedAt: Date;
    lastUsedAt: Date | null;
  }>;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseJsonOutput(raw: string): DocAnalysisResult {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<DocAnalysisResult>;
  return {
    executiveSummary: String(parsed.executiveSummary ?? ""),
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(normalizeSection) : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions.map(normalizeSection) : [],
    criticalQuestions: Array.isArray(parsed.criticalQuestions)
      ? parsed.criticalQuestions.filter((item): item is string => typeof item === "string").slice(0, 8)
      : [],
    draftResponse: String(parsed.draftResponse ?? ""),
  };
}

function normalizeSection(value: unknown): { title: string; body: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { title: "Item", body: String(value ?? "") };
  }
  const record = value as Record<string, unknown>;
  return {
    title: typeof record.title === "string" ? record.title : "Item",
    body: typeof record.body === "string" ? record.body : "",
  };
}

async function getDriveToken(userId: string): Promise<string> {
  const user = (await prisma.user.findUnique({
    where: { id: userId },
    include: { integrations: { where: { provider: "gdrive", status: "connected" } } },
  })) as UserWithDrive | null;
  const integration = user?.integrations[0];
  if (!integration) throw new Error("Google Drive nao conectado.");
  const token = await tryEnsureFreshAccessToken(integration);
  if (!token) throw new Error("Token do Google Drive indisponivel.");
  return token;
}

async function extractUploadText(file: UploadedDocumentInput): Promise<string> {
  const buffer = Buffer.from(file.base64, "base64");
  if (file.mimeType === "text/plain" || file.fileName.toLowerCase().endsWith(".txt")) {
    return buffer.toString("utf-8").slice(0, 16000);
  }
  if (
    file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.fileName.toLowerCase().endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.slice(0, 16000);
  }
  if (file.mimeType === "application/pdf" || file.fileName.toLowerCase().endsWith(".pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text.slice(0, 16000);
  }
  throw new Error("Formato nao suportado. Use PDF, DOCX ou TXT.");
}

async function analyzeText(opts: {
  fileName: string;
  mimeType: string;
  text: string;
  instruction?: string;
}): Promise<DocAnalysisResult> {
  if (opts.text.trim().length < 20) throw new Error("Documento sem texto suficiente para analise.");
  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1800,
    temperature: 0.25,
    system: DOC_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Arquivo: ${opts.fileName}
Tipo: ${opts.mimeType}
Pedido do usuario: ${opts.instruction ?? "Analise completa"}

Conteudo extraido:
${opts.text}`,
      },
    ],
  });
  const raw = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  return parseJsonOutput(raw);
}

function toRecord(row: {
  id: string;
  fileName: string;
  mimeType: string;
  source: string;
  fileId: string | null;
  summary: Prisma.JsonValue;
  createdAt: Date;
}): DocumentAnalysisRecord {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    source: row.source === "drive" ? "drive" : "upload",
    fileId: row.fileId,
    summary: row.summary as unknown as DocAnalysisResult,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listDriveDocs(
  userId: string,
  opts: { query?: string; type?: string; max?: number },
): Promise<DriveDocumentFile[]> {
  const token = await getDriveToken(userId);
  const files = opts.query
    ? await driveSearch(token, opts.query, opts.max ?? 20)
    : await driveRecent(token, { mimePrefix: opts.type, maxResults: opts.max ?? 20 });
  return files;
}

export async function analyzeDriveDoc(opts: {
  userId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  instruction?: string;
}): Promise<DocumentAnalysisRecord> {
  const token = await getDriveToken(opts.userId);
  const text = await driveReadFileText(token, opts.fileId, opts.mimeType);
  const summary = await analyzeText({ ...opts, text });
  const saved = await prisma.documentAnalysis.create({
    data: {
      userId: opts.userId,
      fileName: opts.fileName,
      mimeType: opts.mimeType,
      source: "drive",
      fileId: opts.fileId,
      summary: asJson(summary),
    },
  });
  return toRecord(saved);
}

export async function analyzeUploadedDoc(opts: {
  userId: string;
  file: UploadedDocumentInput;
  instruction?: string;
}): Promise<DocumentAnalysisRecord> {
  const text = await extractUploadText(opts.file);
  const summary = await analyzeText({
    fileName: opts.file.fileName,
    mimeType: opts.file.mimeType,
    text,
    instruction: opts.instruction,
  });
  const saved = await prisma.documentAnalysis.create({
    data: {
      userId: opts.userId,
      fileName: opts.file.fileName,
      mimeType: opts.file.mimeType,
      source: "upload",
      summary: asJson(summary),
    },
  });
  return toRecord(saved);
}

export async function listDocAnalyses(userId: string): Promise<DocumentAnalysisRecord[]> {
  const rows = await prisma.documentAnalysis.findMany({
    where: { userId },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      source: true,
      fileId: true,
      summary: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return rows.map(toRecord);
}
