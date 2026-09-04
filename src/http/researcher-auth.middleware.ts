/**
 * researcher-auth.middleware.ts
 * Valida Bearer JWT de pesquisadora e disponibiliza req.researcherId.
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service';

// Augment Express Request com researcherId
declare global {
  namespace Express {
    interface Request {
      researcherId?: string;
    }
  }
}

export function researcherAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header) {
    res.status(401).json({ error: 'Header Authorization ausente.' });
    return;
  }

  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Header Authorization malformado. Use: Bearer <token>' });
    return;
  }

  const token = header.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Token ausente no header Authorization.' });
    return;
  }

  try {
    req.researcherId = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Token JWT inválido ou expirado.' });
  }
}
