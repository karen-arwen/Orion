import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { promises as fs } from "node:fs";
import path from "node:path";

/* ═══════════════════════════════════════════════════════════════════
   FILE ANALYSIS — Claude analisa arquivos do usuário.

   Suporta: PDF (texto), CSV, código, texto puro, JSON.
   O arquivo é lido, truncado se necessário, e enviado ao Claude
   com instruções contextuais baseadas no tipo de arquivo.
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB max
const MAX_CONTENT_CHARS = 50_000;

const ANALYSIS_PROMPTS: Record<string, string> = {
  csv: "Analise este CSV. Resuma: quantas linhas/colunas, tipos de dados, padroes, anomalias, e insights uteis. Se for financeiro, calcule totais e medias.",
  json: "Analise este JSON. Descreva a estrutura, tipos, dados interessantes e possiveis problemas.",
  code: "Analise este codigo. Descreva: o que faz, qualidade, possiveis bugs, sugestoes de melhoria. Seja especifico.",
  pdf: "Este e o texto extraido de um PDF. Resuma o conteudo principal, pontos-chave e acao necessaria.",
  text: "Analise este documento. Resuma conteudo, pontos importantes e sugira proximos passos se aplicavel.",
  image: "Descreva esta imagem em detalhe. Se for um screenshot, identifique o que esta na tela. Se for um documento, extraia o texto.",
};

function detectFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if ([".csv", ".tsv"].includes(ext)) return "csv";
  if ([".json", ".jsonl"].includes(ext)) return "json";
  if ([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".rb", ".php", ".swift", ".kt"].includes(ext)) return "code";
  if ([".pdf"].includes(ext)) return "pdf";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext)) return "image";
  return "text";
}

export interface FileAnalysisResult {
  filename: string;
  fileType: string;
  sizeBytes: number;
  analysis: string;
  truncated: boolean;
}

export async function analyzeFile(
  filePath: string,
  customPrompt?: string,
): Promise<FileAnalysisResult> {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`Arquivo muito grande: ${(stat.size / 1024 / 1024).toFixed(1)}MB (max: 2MB)`);
  }

  const filename = path.basename(filePath);
  const fileType = detectFileType(filename);

  // Read file content
  let content: string;
  let truncated = false;

  if (fileType === "image") {
    // For images, read as base64 and use vision
    const buffer = await fs.readFile(filePath);
    const base64 = buffer.toString("base64");
    const mimeType = filename.endsWith(".png") ? "image/png"
      : filename.endsWith(".gif") ? "image/gif"
      : filename.endsWith(".webp") ? "image/webp"
      : "image/jpeg";

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
          { type: "text", text: customPrompt ?? ANALYSIS_PROMPTS.image ?? "Descreva esta imagem." },
        ],
      }],
    });

    return {
      filename,
      fileType: "image",
      sizeBytes: stat.size,
      analysis: msg.content[0]?.type === "text" ? msg.content[0].text : "Nao foi possivel analisar a imagem.",
      truncated: false,
    };
  }

  // Text-based files
  const raw = await fs.readFile(filePath, "utf-8");
  if (raw.length > MAX_CONTENT_CHARS) {
    content = raw.slice(0, MAX_CONTENT_CHARS) + "\n\n[... truncado, arquivo tem " + raw.length + " caracteres ...]";
    truncated = true;
  } else {
    content = raw;
  }

  const prompt = customPrompt ?? ANALYSIS_PROMPTS[fileType] ?? ANALYSIS_PROMPTS.text!;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: "Voce e o O.R.I.O.N analisando um arquivo do usuario. Seja direto e acionavel.",
    messages: [{
      role: "user",
      content: `Arquivo: ${filename} (${fileType}, ${(stat.size / 1024).toFixed(1)}KB)\n\n${prompt}\n\n--- CONTEUDO ---\n${content}`,
    }],
  });

  return {
    filename,
    fileType,
    sizeBytes: stat.size,
    analysis: msg.content[0]?.type === "text" ? msg.content[0].text : "Analise indisponivel.",
    truncated,
  };
}
