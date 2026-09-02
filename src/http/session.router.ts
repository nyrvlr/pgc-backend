/**
 * session.router.ts
 * Endpoints HTTP de gerenciamento de sessões.
 * Delega toda lógica ao session.service — sem regras de negócio aqui.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  addParticipant,
  createSession,
  getSession,
  startSession,
} from '../services/session.service';
import { type SequenceVariant } from '../domain/experiment.types';

export const sessionRouter = Router();

const VALID_VARIANTS: SequenceVariant[] = ['ABAC', 'ACAB', 'BCBC', 'CBCB'];
const VALID_SLOTS = ['P1', 'P2'];

// ---------------------------------------------------------------------------
// POST /sessions
// ---------------------------------------------------------------------------

sessionRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const { researcherId, name, sequenceVariant } = req.body ?? {};

  if (!researcherId || typeof researcherId !== 'string') {
    res.status(400).json({ error: 'researcherId é obrigatório.' });
    return;
  }
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name é obrigatório.' });
    return;
  }
  if (!sequenceVariant || !VALID_VARIANTS.includes(sequenceVariant)) {
    res.status(400).json({ error: `sequenceVariant deve ser um de: ${VALID_VARIANTS.join(', ')}.` });
    return;
  }

  try {
    const session = await createSession(researcherId, name, sequenceVariant as SequenceVariant);
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
    const participant = await addParticipant(sessionId, slot as 'P1' | 'P2', displayName, participantCode);
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
    const session = await startSession(sessionId);
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
    const session = await getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: `Session não encontrada: ${sessionId}` });
      return;
    }
    res.status(200).json(session);
  } catch (err) {
    next(err);
  }
});
