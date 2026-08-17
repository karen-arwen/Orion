import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { globalSearch } from "../modules/search.service.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const q = (req.query["q"] as string) ?? "";
    const results = await globalSearch(req.user!.id, q);
    res.json({ results });
  } catch (err) {
    console.error("search error:", err);
    res.status(500).json({ error: "search failed" });
  }
});

export { router as searchRouter };
