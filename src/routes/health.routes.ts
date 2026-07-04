import { Router, Request, Response } from "express";
import { prisma } from "../config/prisma";

const router = Router();

// Verifica se o servidor está de pé e se o banco responde.
router.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "conectado" });
  } catch {
    res.status(503).json({ status: "erro", database: "indisponível" });
  }
});

export default router;
