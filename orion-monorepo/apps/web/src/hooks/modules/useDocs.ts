import { useCallback, useEffect, useState } from "react";
import type { DocumentAnalysisRecord, DriveDocumentFile, UploadedDocumentInput } from "@orion/types";
import { api } from "../../lib/api.js";

interface DocsState {
  files: DriveDocumentFile[];
  analyses: DocumentAnalysisRecord[];
  active: DocumentAnalysisRecord | null;
  isLoading: boolean;
  error: string | null;
  fetchDrive: (query?: string) => Promise<void>;
  fetchAnalyses: () => Promise<void>;
  analyzeDrive: (file: DriveDocumentFile, instruction?: string) => Promise<void>;
  analyzeUpload: (file: UploadedDocumentInput, instruction?: string) => Promise<void>;
}

export function useDocs(): DocsState {
  const [files, setFiles] = useState<DriveDocumentFile[]>([]);
  const [analyses, setAnalyses] = useState<DocumentAnalysisRecord[]>([]);
  const [active, setActive] = useState<DocumentAnalysisRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDrive = useCallback(async (query?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.docs.driveFiles({ query, max: 20 });
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao listar Drive.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAnalyses = useCallback(async () => {
    try {
      const data = await api.docs.analyses();
      setAnalyses(data);
      setActive((current) => current ?? data[0] ?? null);
    } catch {
      // historico vazio ou auth ainda carregando
    }
  }, []);

  const analyzeDrive = useCallback(async (file: DriveDocumentFile, instruction?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.docs.analyzeDrive({
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
        instruction,
      });
      setActive(result);
      setAnalyses((items) => [result, ...items.filter((item) => item.id !== result.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao analisar documento.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const analyzeUpload = useCallback(async (file: UploadedDocumentInput, instruction?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.docs.analyzeUpload({ file, instruction });
      setActive(result);
      setAnalyses((items) => [result, ...items.filter((item) => item.id !== result.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao analisar upload.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDrive();
    void fetchAnalyses();
  }, [fetchDrive, fetchAnalyses]);

  return { files, analyses, active, isLoading, error, fetchDrive, fetchAnalyses, analyzeDrive, analyzeUpload };
}
