import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";

export const onboardingRouter: Router = Router();

const completeSchema = z.object({
  mode: z.enum(["SILENCIOSO", "NORMAL", "STARK"]),
  primaryModule: z.string().max(40),
  focusAreas: z.array(z.string().max(40)).max(8).optional(),
  workArea: z.string().min(1).max(80),
  hobbies: z.array(z.string()).max(15),
  goal: z.string().max(500),
  communicationStyle: z.enum(["direto", "detalhado", "estrategico", "provocativo"]).default("estrategico"),
  decisionStyle: z.enum(["rapido", "analitico", "cauteloso"]).default("analitico"),
  autonomyLimits: z.array(z.string().max(120)).max(8).default([]),
});

const MODULE_BUNDLES: Record<string, string[]> = {
  comms: ["comms", "calendar"],
  life: ["life", "focus", "habit"],
  career: ["career", "know", "docs", "news"],
  know: ["know", "lang"],
  creative: ["creative", "entert", "gaming"],
  health: ["health", "sleep", "mindset", "focus", "habit"],
  finance: ["finance", "shop"],
  security: ["sec"],
  social: ["social", "comms"],
};

function modulesForSelection(primaryModule: string, focusAreas: string[]): string[] {
  const selected = new Set<string>([primaryModule]);
  for (const id of [primaryModule, ...focusAreas]) {
    for (const moduleId of MODULE_BUNDLES[id] ?? [id]) selected.add(moduleId);
  }
  return [...selected].slice(0, 12);
}

function preferenceRows(userId: string, body: z.infer<typeof completeSchema>) {
  const focusAreas = body.focusAreas?.length ? body.focusAreas : [body.primaryModule];
  return [
    { userId, key: "communication_style", value: body.communicationStyle, layer: "current" as const, confidence: 0.92 },
    { userId, key: "decision_style", value: body.decisionStyle, layer: "current" as const, confidence: 0.9 },
    { userId, key: "primary_focus", value: body.primaryModule, layer: "current" as const, confidence: 0.9 },
    { userId, key: "focus_areas", value: focusAreas.join(", "), layer: "current" as const, confidence: 0.86 },
    { userId, key: "work_area", value: body.workArea, layer: "current" as const, confidence: 0.9 },
    ...(body.hobbies.length
      ? [
          { userId, key: "personal_interests", value: body.hobbies.join(", "), layer: "current" as const, confidence: 0.78 },
          { userId, key: "nostalgia_seed", value: body.hobbies.slice(0, 5).join(", "), layer: "nostalgia" as const, confidence: 0.45 },
        ]
      : []),
    ...(body.goal ? [{ userId, key: "current_goal", value: body.goal, layer: "current" as const, confidence: 0.95 }] : []),
    ...(body.autonomyLimits.length
      ? [{ userId, key: "autonomy_limits", value: body.autonomyLimits.join(" | "), layer: "current" as const, confidence: 0.95 }]
      : []),
    { userId, key: "exploration_budget", value: "10% das sugestoes podem ser exploratorias, desde que explicadas.", layer: "exploration" as const, confidence: 0.62 },
  ];
}

/** GET /v1/onboarding/status — frontend usa pra decidir se redireciona */
onboardingRouter.get("/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.user.id },
      select: { onboardedAt: true },
    });
    res.json({
      ok: true,
      data: { onboarded: Boolean(profile?.onboardedAt), onboardedAt: profile?.onboardedAt ?? null },
    });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/onboarding/complete — submete os 4 passos de uma vez */
onboardingRouter.post("/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = completeSchema.parse(req.body);
    const focusAreas = body.focusAreas?.length ? body.focusAreas : [body.primaryModule];
    const moduleIds = modulesForSelection(body.primaryModule, focusAreas);

    // 1. Salva mode no User
    await prisma.user.update({
      where: { id: req.user.id },
      data: { mode: body.mode },
    });

    // 2. Marca profile como onboardedAt + salva bio rica
    const bioParts = [
      `Area: ${body.workArea}`,
      `Foco: ${focusAreas.join(", ")}`,
      `Estilo: ${body.communicationStyle} / ${body.decisionStyle}`,
      body.hobbies.length > 0 ? `Hobbies: ${body.hobbies.join(", ")}` : null,
      body.goal ? `Objetivo do mes: ${body.goal}` : null,
      body.autonomyLimits.length > 0 ? `Limites: ${body.autonomyLimits.join("; ")}` : null,
    ].filter(Boolean);
    await prisma.userProfile.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        bio: bioParts.join(" · "),
        onboardedAt: new Date(),
      },
      update: {
        bio: bioParts.join(" · "),
        onboardedAt: new Date(),
      },
    });

    // 3. Ativa modulos relevantes por perfil
    await Promise.all(
      moduleIds.map((moduleId) =>
        prisma.userModule.upsert({
          where: { userId_moduleId: { userId: req.user!.id, moduleId } },
          create: { userId: req.user!.id, moduleId, enabled: true, config: { source: "onboarding" } },
          update: { enabled: true, config: { source: "onboarding" }, lastUsed: new Date() },
        }),
      ),
    );

    // 4. Preferencias explicitas para o perfil adaptativo
    await Promise.all(
      preferenceRows(req.user.id, body).map((pref) =>
        prisma.userPreference.upsert({
          where: { userId_key_layer: { userId: pref.userId, key: pref.key, layer: pref.layer } },
          create: pref,
          update: { value: pref.value, confidence: pref.confidence },
        }),
      ),
    );

    // 5. Se houver objetivo, cria um projeto-base para dar contexto real ao painel
    if (body.goal.trim()) {
      await prisma.project.create({
        data: {
          userId: req.user.id,
          name: body.goal.trim().slice(0, 140),
          color: "#00D4FF",
          progress: 5,
          status: "calibrado no onboarding",
        },
      });
    }

    // 6. Cria memórias iniciais com as respostas (fire-and-forget)
    void (async () => {
      try {
        await prisma.memory.createMany({
          data: [
            {
              userId: req.user!.id,
              type: "fact",
              content: `Trabalha com ${body.workArea}`,
              importance: 0.9,
              pinned: true,
              embedding: [],
            },
            {
              userId: req.user!.id,
              type: "preference",
              content: `Prefere comunicacao ${body.communicationStyle} e decisoes em estilo ${body.decisionStyle}.`,
              importance: 0.86,
              pinned: true,
              embedding: [],
            },
            {
              userId: req.user!.id,
              type: "preference",
              content: `Areas prioritarias atuais: ${focusAreas.join(", ")}. Modulos ativados: ${moduleIds.join(", ")}.`,
              importance: 0.82,
              pinned: true,
              embedding: [],
            },
            ...(body.hobbies.length > 0
              ? [
                  {
                    userId: req.user!.id,
                    type: "preference" as const,
                    content: `Hobbies: ${body.hobbies.join(", ")}`,
                    importance: 0.8,
                    pinned: false,
                    embedding: [],
                  },
                ]
              : []),
            ...(body.goal
              ? [
                  {
                    userId: req.user!.id,
                    type: "fact" as const,
                    content: `Meta atual: ${body.goal}`,
                    importance: 1.0,
                    pinned: true,
                    embedding: [],
                  },
                ]
              : []),
            ...(body.autonomyLimits.length
              ? [
                  {
                    userId: req.user!.id,
                    type: "preference" as const,
                    content: `Limites de autonomia: ${body.autonomyLimits.join("; ")}`,
                    importance: 0.95,
                    pinned: true,
                    embedding: [],
                  },
                ]
              : []),
          ],
        });
      } catch (err) {
        console.warn("[onboarding] seed de memórias falhou:", (err as Error).message);
      }
    })();

    res.json({ ok: true, data: { onboarded: true, enabledModules: moduleIds } });
  } catch (err) {
    next(err);
  }
});
