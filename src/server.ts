/**
 * server.ts
 * Ponto de entrada: inicia o servidor HTTP na porta configurada.
 */

import { app } from './http/app';
import { env } from './config/env';

app.listen(env.port, () => {
  console.log(`PGC backend em http://localhost:${env.port} [${env.nodeEnv}]`);
});
