import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/* ═══════════════════════════════════════════════════════════════════
   State JWT minimalista — usado no parâmetro ?state do OAuth.

   Por que assinar: o Google chama nosso /callback de fora; não temos
   sessão Clerk lá. O state carrega o userId assinado pra gente saber
   QUEM autorizou. Sem assinatura, qualquer um poderia forjar.

   Implementação simples com HMAC-SHA256 (sem lib externa).
═══════════════════════════════════════════════════════════════════ */

interface StatePayload {
  userId: string;
  exp: number; // unix timestamp (segundos)
  nonce: string;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

function sign(payloadEncoded: string): string {
  return base64url(createHmac("sha256", env.JWT_SECRET).update(payloadEncoded).digest());
}

/** Cria um state válido por 10 minutos. */
export function createState(userId: string): string {
  const payload: StatePayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: randomBytes(8).toString("hex"),
  };
  const encoded = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

/** Lê e valida um state. Joga se inválido ou expirado. */
export function readState(state: string): StatePayload {
  const parts = state.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("state malformado");
  }
  const [encoded, sig] = parts;

  const expected = sign(encoded);
  const sigBuf = fromBase64url(sig);
  const expBuf = fromBase64url(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("state com assinatura inválida");
  }

  const payload = JSON.parse(fromBase64url(encoded).toString("utf-8")) as StatePayload;
  if (!payload.userId || !payload.exp) throw new Error("state com payload incompleto");
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("state expirado");
  return payload;
}
