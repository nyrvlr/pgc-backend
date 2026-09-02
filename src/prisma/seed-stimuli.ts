/**
 * seed-stimuli.ts
 * Popula as tabelas Stimulus e TrialTemplate com os dados do experimento físico.
 *
 * Fonte dos dados: src/prisma/seed-data.ts
 * Estratégia de idempotência: upsert em todos os registros.
 * Não conecta ao banco diretamente — use DATABASE_URL no ambiente.
 */

import { PrismaClient } from '@prisma/client';
import { buildStimulusDescriptors, buildTrialTemplateDescriptors } from './seed-data';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de estímulos e templates...');

  // Etapa 1: upsert dos 64 Stimulus
  const stimulusDescriptors = buildStimulusDescriptors();
  const stimulusIdByKey = new Map<string, string>();

  for (const s of stimulusDescriptors) {
    const key = `${s.distributorCharacter}|${s.distributorDistribution}|${s.receptorDistribution}`;
    const record = await prisma.stimulus.upsert({
      where: {
        distributorCharacter_distributorDistribution_receptorDistribution: s.upsertKey,
      },
      update: { endowment: s.endowment, receptorCharacter: s.receptorCharacter },
      create: {
        endowment: s.endowment,
        distributorDistribution: s.distributorDistribution,
        receptorDistribution: s.receptorDistribution,
        distributorCharacter: s.distributorCharacter,
        receptorCharacter: s.receptorCharacter,
      },
    });
    stimulusIdByKey.set(key, record.id);
  }

  console.log(`  ${stimulusIdByKey.size} Stimulus upsertados.`);

  // Etapa 2: upsert dos 256 TrialTemplate
  const templateDescriptors = buildTrialTemplateDescriptors();
  let count = 0;

  for (const t of templateDescriptors) {
    const stimulusId = stimulusIdByKey.get(t.stimulusKey)!;
    await prisma.trialTemplate.upsert({
      where: {
        sequenceVariant_blockNumber_trialInBlock: {
          sequenceVariant: t.sequenceVariant,
          blockNumber: t.blockNumber,
          trialInBlock: t.trialInBlock,
        },
      },
      update: { stimulusId },
      create: {
        sequenceVariant: t.sequenceVariant,
        blockNumber: t.blockNumber,
        trialInBlock: t.trialInBlock,
        stimulusId,
      },
    });
    count++;
  }

  console.log(`  ${count} TrialTemplate upsertados.`);
  console.log('Seed concluído.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
