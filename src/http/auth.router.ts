/**
 * auth.router.ts
 * Rotas de autenticação da pesquisadora.
 *
 * POST /auth/login  — login com email/senha, retorna JWT
 * GET  /auth/me     — retorna dados da pesquisadora autenticada
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { login, getResearcher } from '../services/auth.service';
import { researcherAuth } from './researcher-auth.middleware';
import { SessionBootstrapError } from '../services/session.drafts';

export const authRouter = Router();

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body ?? {};

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'email é obrigatório.' });
    return;
  }
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'password é obrigatório.' });
    return;
  }

  try {
    const result = await login(email, password);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof SessionBootstrapError) {
      res.status(401).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------

authRouter.get('/me', researcherAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const researcher = await getResearcher(req.researcherId!);
    res.status(200).json({ researcher });
  } catch (err) {
    if (err instanceof SessionBootstrapError) {
      // Token válido mas researcher deletada da base — improvável mas tratado
      res.status(401).json({ error: err.message });
      return;
    }
    next(err);
  }
});
