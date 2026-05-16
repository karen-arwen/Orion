import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

/**
 * Erros operacionais que viram resposta JSON sem stacktrace pro cliente.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: Record<string, unknown> | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      ok: false,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Payload inválido",
        details: err.flatten(),
      },
    });
    return;
  }

  console.error("[orion] erro não tratado:", err);
  res.status(500).json({
    ok: false,
    error: { code: "INTERNAL_ERROR", message: "Falha interna do núcleo." },
  });
}
