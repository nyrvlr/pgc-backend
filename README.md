# pgc-backend

Backend do sistema do **Jogo da Punição Altruísta** (Experimento 1).
Node + TypeScript + Express + Socket.IO + Prisma + PostgreSQL (Neon).

## Pré-requisitos

- Node.js 18+ (recomendado 20+)
- Uma string de conexão do PostgreSQL (Neon)

## Setup

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# edite o .env e cole a DATABASE_URL do Neon (use a string COM pooling)

# 3. Gerar o Prisma Client
npm run prisma:generate

# 4. Criar as tabelas no banco (primeira migration)
npm run prisma:migrate
# quando pedir um nome, use algo como: init

# 5. Subir o servidor em desenvolvimento
npm run dev
```

Depois de subir, teste: <http://localhost:3000/api/health>
Deve responder `{ "status": "ok", "database": "conectado" }`.

## Scripts

| Script                    | O que faz |
|---------------------------|-----------|
| `npm run dev`             | Sobe o servidor com hot-reload (tsx watch). |
| `npm run build`           | Compila TypeScript para `dist/`. |
| `npm start`               | Roda a versão compilada (`dist/server.js`). |
| `npm run prisma:generate` | Gera o Prisma Client a partir do schema. |
| `npm run prisma:migrate`  | Cria/aplica migrations no banco. |
| `npm run prisma:studio`   | Abre o Prisma Studio (visualizador do banco). |

## Estrutura

```
src/
├── config/        # env, cliente Prisma (singleton)
├── routes/        # rotas REST (administrativo: experimento, dupla, sessão, CSV)
├── controllers/   # (a preencher) recebem req/res, chamam services
├── services/      # regras de negócio — inclui a lógica de punição + testes
├── sockets/       # camada de tempo real (Socket.IO) — sessão ao vivo
├── middlewares/   # (a preencher) auth, tratamento de erro
├── prisma/        # schema.prisma e migrations
├── types/         # (a preencher) tipos compartilhados
├── app.ts         # configura o Express (middlewares + rotas)
└── server.ts      # junta Express + Socket.IO e sobe o servidor HTTP
```

## Testar a lógica de punição

```bash
npx tsx --test src/services/punicao.test.ts
```

Resultado esperado: `# pass 24  # fail 0`.

## Arquitetura em duas camadas de comunicação

- **REST (`/api/...`)** — operações administrativas e pontuais.
- **WebSocket (Socket.IO)** — a sessão ao vivo em tempo real.

Ambas chamam os **mesmos Services**. Regra de ouro: **o cliente nunca decide
nada** (consenso, condição vigente, moedas) — quem decide é o servidor.

## Nota sobre o Prisma

O projeto usa **Prisma 6** (estável e maduro), escolha deliberada de
tecnologia battle-tested adequada ao prazo do TCC. Rode
`npm run prisma:generate` após clonar o repo ou alterar o `schema.prisma`.
