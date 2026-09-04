/**
 * provision-researcher.ts
 * Lógica de provisionamento de pesquisadora — separada do CLI para testabilidade.
 *
 * Nunca loga senha nem passwordHash.
 * Não altera auth.service.ts.
 */

import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';

const BCRYPT_ROUNDS = 10;

export type ProvisionInput = {
  name:     string;
  email:    string;
  password: string;
};

export type ProvisionResult = {
  id:    string;
  name:  string;
  email: string;
};

/**
 * Valida que os três campos obrigatórios existem e não são vazios.
 * Lança Error com mensagem amigável se inválido.
 */
export function validateInput(
  name:     string | undefined,
  email:    string | undefined,
  password: string | undefined,
): ProvisionInput {
  const missing: string[] = [];
  if (!name?.trim())     missing.push('RESEARCHER_NAME');
  if (!email?.trim())    missing.push('RESEARCHER_EMAIL');
  if (!password?.trim()) missing.push('RESEARCHER_PASSWORD');

  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes ou vazias: ${missing.join(', ')}`
    );
  }

  return {
    name:     name!.trim(),
    email:    email!.trim().toLowerCase(),  // normalização obrigatória
    password: password!.trim(),
  };
}

/**
 * Provisiona (cria ou atualiza) a pesquisadora no banco.
 * Retorna somente id, name e email — nunca senha ou passwordHash.
 */
export async function provisionResearcher(input: ProvisionInput): Promise<ProvisionResult> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const researcher = await prisma.researcher.upsert({
    where:  { email: input.email },
    update: { name: input.name, passwordHash },
    create: { name: input.name, email: input.email, passwordHash },
    select: { id: true, name: true, email: true },   // passwordHash excluído
  });

  return researcher;
}
