# PGC Backend

Backend do sistema web desenvolvido para o Projeto de Graduação (PGC), com foco na implementação de um experimento comportamental sobre punição altruísta.

Este repositório contém a API responsável por:

- Gerenciamento de experimentos
- Cadastro de participantes
- Formação de duplas
- Execução de sessões experimentais
- Registro de tentativas, respostas, consenso e consequências
- Garantia de integridade científica dos dados

---

## Tecnologias Utilizadas

- Node.js
- Express
- TypeScript
- PostgreSQL (Neon)
- Prisma ORM

---

## Arquitetura

O backend segue uma arquitetura em camadas:

- **Routes**: definição dos endpoints
- **Controllers**: camada intermediária entre requisição e lógica
- **Services**: regras de negócio
- **Prisma**: camada de acesso ao banco de dados

---

## Estrutura do Projeto
src/
├── controllers/
├── services/
├── routes/
├── middlewares/
├── config/
├── prisma/
└── server.ts

---


---

## Banco de Dados

O banco de dados foi modelado em PostgreSQL com aplicação de:

- Chaves primárias
- Chaves estrangeiras
- Constraints de unicidade
- Constraints de domínio
- Integridade referencial

O banco está hospedado na plataforma Neon.

---

## Objetivo Científico

O sistema foi projetado para garantir:

- Resposta única por participante em cada tentativa
- Exposição única de cartão por sessão
- Relação 1:1 entre tentativa, consenso e consequência
- Rastreabilidade completa do experimento

A integridade experimental é garantida tanto no nível da aplicação quanto no nível estrutural do banco de dados.

---

## Como Rodar o Projeto

Em desenvolvimento (via GitHub Codespaces):

```bash
npm install
npm run dev
```

---
Status do Projeto

[X] Modelagem de banco validada

[X] Implementação física do banco em PostgreSQL

[] Setup do backend

[] Implementação dos endpoints principais

[] Integração com frontend

[] Deploy

---

## Autoras
Projeto desenvolvido como parte do Trabalho de Conclusão de Curso em Ciência da Computação.