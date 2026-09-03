/**
 * auth.middleware.ts
 * Extrai e valida o Bearer token do header Authorization.
 * Injeta `req.accessToken` se válido; retorna 401 caso contrário.
 */

import { type Request, type Response, type NextFunction } from 'express';

// Estende o tipo Request para carregar o token extraído
declare global {
  namespace Express {
    interface Request {
      accessToken?: string;
    }
  }
}

export function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];

  if (!header || typeof header !== 'string') {
    res.status(401).json({ error: 'Authorization header ausente.' });
    return;
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    res.status(401).json({ error: 'Authorization header malformado. Use: Bearer <token>.' });
    return;
  }

  req.accessToken = parts[1];
  next();
}
