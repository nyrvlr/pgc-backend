/**
 * auth.service.ts
 * Autenticação da pesquisadora: login com email/senha, emissão de JWT.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { SessionBootstrapError } from './session.drafts';

const JWT_EXPIRES_IN = '8h';

export type ResearcherPublic = {
  id:    string;
  name:  string;
  email: string;
};

export type LoginResult = {
  token:      string;
  researcher: ResearcherPublic;
};

// Payload gravado no JWT — apenas o identificador mínimo
export type JwtPayload = {
  sub: string; // researcherId
};

/**
 * Valida credenciais e retorna token JWT + dados públicos da pesquisadora.
 * Em caso de falha (email não encontrado OU senha incorreta) lança o mesmo
 * erro genérico para não revelar se o email existe.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const researcher = await prisma.researcher.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, passwordHash: true },
  });

  // Hash bcrypt válido de uma senha placeholder — garante que bcrypt.compare
  // seja chamado mesmo quando o email não existe (previne timing attack).
  // O hash é constante para não desperdiçar CPU a cada request malsucedido.
  const DUMMY_HASH = '$2b$10$rv3JaxvNiUGGNmbFpE3je.8Lxxing2H/Ya8FtRTgb.67pGuV21HqO';
  const hashToCompare = researcher?.passwordHash ?? DUMMY_HASH;
  const valid = await bcrypt.compare(password, hashToCompare);

  if (!researcher || !valid) {
    throw new SessionBootstrapError('Credenciais inválidas.');
  }

  const payload: JwtPayload = { sub: researcher.id };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: JWT_EXPIRES_IN });

  return {
    token,
    researcher: {
      id:    researcher.id,
      name:  researcher.name,
      email: researcher.email,
      // passwordHash nunca incluído
    },
  };
}

/**
 * Verifica um Bearer JWT e retorna o researcherId.
 * Lança SessionBootstrapError se inválido ou expirado.
 */
export function verifyToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof (payload as JwtPayload).sub !== 'string' ||
      !(payload as JwtPayload).sub
    ) {
      throw new SessionBootstrapError('Token JWT inválido ou expirado.');
    }
    return (payload as JwtPayload).sub;
  } catch (err) {
    if (err instanceof SessionBootstrapError) throw err;
    throw new SessionBootstrapError('Token JWT inválido ou expirado.');
  }
}

/**
 * Busca a pesquisadora pelo id e retorna dados públicos.
 * Lança SessionBootstrapError se não encontrada.
 */
export async function getResearcher(researcherId: string): Promise<ResearcherPublic> {
  const researcher = await prisma.researcher.findUnique({
    where: { id: researcherId },
    select: { id: true, name: true, email: true },
  });
  if (!researcher) {
    throw new SessionBootstrapError('Pesquisadora não encontrada.');
  }
  return researcher;
}
