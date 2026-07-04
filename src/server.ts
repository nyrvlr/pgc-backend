import { createServer } from "http";
import { createApp } from "./app";
import { initSockets } from "./sockets";
import { env } from "./config/env";

// Ponto de entrada do backend.
// Express e Socket.IO compartilham o MESMO servidor HTTP — o REST atende as
// operações administrativas (/api/...) e o WebSocket atende a sessão ao vivo.
const app = createApp();
const httpServer = createServer(app);

initSockets(httpServer);

httpServer.listen(env.port, () => {
  console.log(`Servidor no ar em http://localhost:${env.port}`);
  console.log(`Health check: http://localhost:${env.port}/api/health`);
});
