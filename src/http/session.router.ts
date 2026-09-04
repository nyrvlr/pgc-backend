/**
 * session.router.ts
 * Endpoints HTTP de gerenciamento de sessões.
 * Todas as rotas exigem autenticação JWT da pesquisadora.
 * researcherId vem sempre de req.researcherId (JWT), nunca do body.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  addParticipant,
  createSession,
  getSession,
  getSessionPanel,
  getParticipantAccess,
  listSessions,
  startSession,
} from '../services/session.service';
import { researcherAuth } from './researcher-auth.middleware';
import { type SequenceVariant } from '../domain/experiment.types';

export const sessionRouter = Router();

// Todas as rotas exigem JWT válido da pesquisadora
sessionRouter.use(researcherAuth);

const VALID_VARIANTS: SequenceVariant[] = ['ABAC', 'ACAB', 'BCBC', 'CBCB'];
const VALID_SLOTS = ['P1', 'P2'];

// ---------------------------------------------------------------------------
// GET /sessions  — lista sessões da pesquisadora autenticada
// ---------------------------------------------------------------------------

sessionRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await listSessions(req.researcherId!);
    res.status(200).json(sessions);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /sessions
// ---------------------------------------------------------------------------

sessionRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const { name, sequenceVariant } = req.body ?? {};
  // researcherId vem do JWT — body.researcherId é ignorado

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name é obrigatório.' });
    return;
  }
  if (!sequenceVariant || !VALID_VARIANTS.includes(sequenceVariant)) {
    res.status(400).json({ error: `sequenceVariant deve ser um de: ${VALID_VARIANTS.join(', ')}.` });
    return;
  }

  try {
    const session = await createSession(req.researcherId!, name, sequenceVariant as SequenceVariant);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /sessions/:sessionId/participants
// ---------------------------------------------------------------------------

sessionRouter.post('/:sessionId/participants', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.params['sessionId'] as string;
  const { slot, displayName, participantCode } = req.body ?? {};

  if (!slot || !VALID_SLOTS.includes(slot)) {
    res.status(400).json({ error: `slot deve ser P1 ou P2.` });
    return;
  }
  if (!displayName || typeof displayName !== 'string') {
    res.status(400).json({ error: 'displayName é obrigatório.' });
    return;
  }
  if (!participantCode || typeof participantCode !== 'string') {
    res.status(400).json({ error: 'participantCode é obrigatório.' });
    return;
  }

  try {
    const participant = await addParticipant(
      sessionId, req.researcherId!, slot as 'P1' | 'P2', displayName, participantCode
    );
    res.status(201).json(participant);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /sessions/:sessionId/start
// ---------------------------------------------------------------------------

sessionRouter.post('/:sessionId/start', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.params['sessionId'] as string;
  try {
    const session = await startSession(sessionId, req.researcherId!);
    res.status(200).json(session);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /sessions/:sessionId
// ---------------------------------------------------------------------------

sessionRouter.get('/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.params['sessionId'] as string;
  try {
    const session = await getSession(sessionId, req.researcherId!);
    if (!session) {
      res.status(404).json({ error: `Session não encontrada: ${sessionId}` });
      return;
    }
    res.status(200).json(session);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /sessions/:sessionId/panel
// ---------------------------------------------------------------------------

sessionRouter.get('/:sessionId/panel', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.params['sessionId'] as string;
  try {
    const panel = await getSessionPanel(sessionId, req.researcherId!);
    res.status(200).json(panel);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /sessions/:sessionId/participant-access
// ---------------------------------------------------------------------------

sessionRouter.get('/:sessionId/participant-access', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.params['sessionId'] as string;
  try {
    const access = await getParticipantAccess(sessionId, req.researcherId!);
    res.status(200).json(access);
  } catch (err) {
    next(err);
  }
});
