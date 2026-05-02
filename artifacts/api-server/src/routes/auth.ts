import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/auth/verify", (req, res) => {
  const { code } = req.body as { code?: string };
  const expected = process.env["ACCESS_CODE"];

  if (!expected) {
    res.status(500).json({ error: "Access code not configured" });
    return;
  }

  if (!code || code !== expected) {
    res.status(401).json({ error: "Invalid access code" });
    return;
  }

  res.json({ ok: true });
});

export default router;
