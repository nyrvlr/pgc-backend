/**
 * app.ts
 * Configuração do Express: middlewares, routers e tratamento de erros.
 * Separado de server.ts para permitir testes sem iniciar a porta.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { SessionBootstrapError } from '../services/session.drafts';
import { sessionRouter } from './session.router';
import { participantRouter } from './participant.router';

export const app = express();

// ---------------------------------------------------------------------------
// Middlewares globais
// ---------------------------------------------------------------------------

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Routers
// ---------------------------------------------------------------------------

app.use('/sessions', sessionRouter);
app.use('/participant', participantRouter);

// ---------------------------------------------------------------------------
// Tratamento centralizado de erros
// ---------------------------------------------------------------------------

// Códigos de erro Prisma relevantes
const PRISMA_CONFLICT  = 'P2002'; // unique constraint violation
const PRISMA_NOT_FOUND = ['P2025', 'P2003']; // record not found / FK violation

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // JSON malformado — lançado pelo express.json()
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status?: number }).status === 400
  ) {
    res.status(400).json({ error: 'JSON malformado.' });
    return;
  }

  // SessionBootstrapError — erros de domínio/regra de negócio
  if (err instanceof SessionBootstrapError) {
    const isNotFound =
      err.message.includes('não encontrada') || err.message.includes('não encontrado');
    res.status(isNotFound ? 404 : 409).json({ error: err.message });
    return;
  }

  // Erros Prisma — identificados pelo campo `code`
  if (err !== null && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code;
    if (code === PRISMA_CONFLICT) {
      res.status(409).json({ error: 'Conflito: registro duplicado.' });
      return;
    }
    if (PRISMA_NOT_FOUND.includes(code)) {
      res.status(404).json({ error: 'Recurso não encontrado.' });
      return;
    }
  }

  console.error('[500]', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});
