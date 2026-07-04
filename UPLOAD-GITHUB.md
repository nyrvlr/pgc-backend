# Como subir estes arquivos no repositório pgc-backend

Você já tem o repositório clonado em `C:\Users\pedro\pgc-backend` (com .git).
Escolha UM dos dois caminhos abaixo.

## Caminho A — Git Bash (recomendado, você já instalou)

1. Descompacte o `pgc-backend-completo.zip`. Ele contém uma pasta
   `pgc-backend/` — copie o CONTEÚDO dela (a pasta `src`, package.json,
   tsconfig.json, README.md, .gitignore, .env.example) para dentro do seu
   `C:\Users\pedro\pgc-backend`, sobrescrevendo README.md e package.json.

   IMPORTANTE (Windows): ative "Itens ocultos" no Explorador de Arquivos
   (aba Exibir) para enxergar e copiar o `.gitignore` e o `.env.example`,
   que começam com ponto.

2. No Git Bash:

   cd ~/pgc-backend
   git status

3. Cole o resultado do `git status` para o Claude conferir. Depois:

   git add .
   git commit -m "Setup do backend e logica de punicao com testes"
   git push origin main

4. Se o push reclamar que o remoto tem commits que você não tem:

   git pull origin main --no-rebase
   # se der conflito em README.md/package.json, mantenha as suas versões:
   git checkout --ours README.md package.json
   git add README.md package.json
   git commit -m "Resolve conflito mantendo versoes de setup"
   git push origin main

## Caminho B — Upload pela web (sem git)

1. Abra https://github.com/nyrvlr/pgc-backend
2. Add file > Upload files.
3. Arraste a pasta `src` inteira (o GitHub preserva as subpastas).
4. Arraste os arquivos da raiz: package.json, tsconfig.json, README.md,
   .gitignore, .env.example (ative "Itens ocultos" para ver os com ponto).
5. Escreva a mensagem do commit e clique em Commit changes.

## SEGURANÇA — leia sempre

- NUNCA suba um arquivo `.env` de verdade (com a senha do Neon). Só o
  `.env.example` vai para o GitHub — ele não tem segredo.
- No `git status`, confira que aparece `.env.example` e NÃO `.env`.

## Depois do upload, para rodar:

    npm install
    cp .env.example .env    # e cole a DATABASE_URL do Neon
    npm run prisma:generate
    npm run prisma:migrate
    npm run dev

Testar a lógica de punição:

    npx tsx --test src/services/punicao.test.ts
