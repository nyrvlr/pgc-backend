import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { env } from "../config/env";

// Inicializa o servidor Socket.IO sobre o mesmo servidor HTTP do Express.
//
// Modelo de salas: cada SESSÃO experimental é uma "room". Os dois dispositivos
// dos participantes e o painel da pesquisadora entram na mesma room e recebem
// os eventos daquela sessão. A máquina de estados da rodada (consenso,
// consequência, avanço) será implementada na próxima etapa — aqui fica apenas
// a fundação da conexão.
export function initSockets(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    if (env.nodeEnv === "development") {
      console.log(`[socket] conectado: ${socket.id}`);
    }

    socket.on("sessao:entrar", (data: { sessionId: string }) => {
      if (data?.sessionId) {
        socket.join(`sessao:${data.sessionId}`);
        if (env.nodeEnv === "development") {
          console.log(`[socket] ${socket.id} entrou na sessao:${data.sessionId}`);
        }
      }
    });

    socket.on("disconnect", () => {
      if (env.nodeEnv === "development") {
        console.log(`[socket] desconectado: ${socket.id}`);
      }
    });
  });

  return io;
}
