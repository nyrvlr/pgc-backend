import express from "express";
import cors from "cors";
import { env } from "./config/env";
import routes from "./routes";

// Cria e configura a aplicação Express (sem subir o servidor — isso fica no
// server.ts). Separar o `app` do `listen` facilita testes futuros.
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.use("/api", routes);

  return app;
}
