/**
 * participant.router.ts
 * Endpoint de acesso do participante via accessToken.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { bearerAuth } from './auth.middleware';
import { getParticipantState } from '../services/participant.service';
import { SessionBootstrapError } from '../services/session.drafts';

export const participantRouter = Router();

// GET /participant/me
participantRouter.get('/me', bearerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = await getParticipantState(req.accessToken!);
    res.status(200).json(state);
  } catch (err) {
    if (err instanceof SessionBootstrapError) {
      res.status(401).json({ error: err.message });
      return;
    }
    next(err);
  }
});
