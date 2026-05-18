import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";

export const onboardingRouter: Router = Router();

const completeSchema = z.object({
  mode: z.enum(["SILENCIOSO", "NORMAL", "STARK"]),
  primaryModule: z.string().max(40),
  workArea: z.string().min(1).max(80),
  hobbies: z.array(z.string()).max(15),
  goal: z.string().max(500),
});

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

    // 1. Salva mode no User
    await prisma.user.update({
      where: { id: req.user.id },
      data: { mode: body.mode },
    });

    // 2. Marca profile como onboardedAt + salva bio rica
    const bioParts = [
      `Área: ${body.workArea}`,
      body.hobbies.length > 0 ? `Hobbies: ${body.hobbies.join(", ")}` : null,
      body.goal ? `Objetivo do mês: ${body.goal}` : null,
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

    // 3. Ativa módulo principal
    if (body.primaryModule) {
      await prisma.userModule.upsert({
        where: { userId_moduleId: { userId: req.user.id, moduleId: body.primaryModule } },
        create: { userId: req.user.id, moduleId: body.primaryModule, enabled: true },
        update: { enabled: true },
      });
    }

    // 4. Cria memórias iniciais com as respostas (fire-and-forget)
    void (async () => {
      try {
        await prisma.memory.createMany({
          data: [
            {
              userId: req.user!.id,
              type: "fact",
              content: `Trabalha com ${body.workArea}`,
              importance: 0.9,
              embedding: [],
            },
            ...(body.hobbies.length > 0
              ? [
                  {
                    userId: req.user!.id,
                    type: "preference" as const,
                    content: `Hobbies: ${body.hobbies.join(", ")}`,
                    importance: 0.8,
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

    res.json({ ok: true, data: { onboarded: true } });
  } catch (err) {
    next(err);
  }
});
