/**
 * provision-researcher.cli.ts
 * Ponto de entrada CLI: lê variáveis de ambiente e chama provisionResearcher().
 * Executado via: npm run researcher:provision
 */

import dotenv from 'dotenv';
dotenv.config();

import { validateInput, provisionResearcher } from './provision-researcher';
import { prisma } from '../config/prisma';

async function main(): Promise<void> {
  const input = validateInput(
    process.env['RESEARCHER_NAME'],
    process.env['RESEARCHER_EMAIL'],
    process.env['RESEARCHER_PASSWORD'],
  );

  console.log(`Provisionando pesquisadora: ${input.email} ...`);

  const result = await provisionResearcher(input);

  // Nunca logar senha ou passwordHash
  console.log('Pesquisadora provisionada com sucesso:');
  console.log(JSON.stringify({ id: result.id, name: result.name, email: result.email }, null, 2));
}

main()
  .catch((err: Error) => {
    console.error('Erro ao provisionar pesquisadora:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
