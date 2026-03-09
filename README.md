# PGC Backend

Backend do sistema web desenvolvido para o **Projeto de Graduação (PGC)**, com foco na implementação de um experimento comportamental sobre **punição altruísta**.

Este repositório contém a **API responsável por gerenciar a execução do experimento**, garantindo coleta estruturada e integridade científica dos dados.

---

# Funcionalidades do Sistema

A API é responsável por:

- Gerenciamento de experimentos
- Cadastro de participantes
- Formação de duplas
- Execução de sessões experimentais
- Registro de tentativas e respostas
- Registro de consenso entre participantes
- Registro das consequências das decisões
- Garantia de integridade científica dos dados experimentais

---

# Tecnologias Utilizadas

## Backend

- Node.js  
- Express  
- TypeScript  

## Banco de Dados

- PostgreSQL (Neon)

## ORM

- Prisma ORM

O **Prisma** é utilizado para gerenciar a comunicação com o banco de dados, permitindo consultas tipadas, controle de migrations e integração nativa com TypeScript.

---

# Arquitetura do Sistema

O backend segue uma **arquitetura em camadas**, separando responsabilidades entre controle de requisições, lógica de negócio e acesso ao banco de dados.

Essa organização facilita manutenção, escalabilidade e compreensão do código.

## Camadas da aplicação

### Routes

Responsáveis por definir os endpoints da API e encaminhar as requisições para os controllers.

### Controllers

Recebem as requisições HTTP, validam parâmetros e coordenam a execução das operações da aplicação.

### Services

Contêm a lógica de negócio do sistema, incluindo as regras relacionadas à execução do experimento.

### Prisma

Camada responsável pela comunicação com o banco de dados PostgreSQL.

---

# Diagrama de Arquitetura
Usuário

│

▼

Interface Web

│

▼

API REST (Node.js + TypeScript)

│

▼

Routes

│

▼

Controllers

│

▼

Services
(Regras de Negócio)

│

▼

Prisma ORM

│

▼
PostgreSQL


Fluxo de dados:
Usuário → Interface → API → Controllers → Services → Prisma → Banco de Dados

---

# Estrutura do Projeto

A aplicação está organizada em módulos com responsabilidades bem definidas:

src/

├── controllers/
│ Responsáveis por receber as requisições HTTP e retornar as respostas da API.

├── services/
│ Contêm a lógica de negócio da aplicação.

├── routes/
│ Definem os endpoints da API.

├── middlewares/
│ Funções intermediárias utilizadas no processamento das requisições.

├── config/
│ Arquivos de configuração da aplicação.

├── prisma/
│ Definição do schema do banco de dados e migrations.

└── server.ts
Arquivo responsável por inicializar o servidor da aplicação.

---

# Modelo de Domínio do Experimento

O sistema foi modelado para representar de forma estruturada todas as etapas do experimento comportamental.

As principais entidades do domínio são:

### Experiment

Representa um experimento criado pela pesquisadora.  
Define as configurações gerais do estudo.

### Session

Cada sessão corresponde à execução de um experimento com uma dupla de participantes.

### Participant

Representa um participante individual do experimento.

### Pair

Representa a dupla de participantes que executa uma sessão experimental.

### Round

Uma sessão é composta por múltiplas rodadas do experimento.

### Attempt

Cada rodada contém tentativas nas quais os participantes observam um cartão e tomam uma decisão.

### Card

Cartões apresentados durante o experimento que representam diferentes situações de divisão de moedas.

### Response

Resposta individual de cada participante em relação ao cartão apresentado.

### Consensus

Resultado final da decisão da dupla após a comparação das respostas.

### Consequence

Consequência aplicada no experimento após a decisão da dupla (ex.: punição ou manutenção da divisão).

---

# Banco de Dados

O banco de dados foi modelado utilizando **PostgreSQL**, com foco na garantia de integridade científica dos dados coletados durante o experimento.

Foram aplicados:

- chaves primárias
- chaves estrangeiras
- constraints de unicidade
- constraints de domínio
- integridade referencial

O banco de dados está hospedado na plataforma **Neon**.

---

# Objetivo Científico

O sistema foi projetado para garantir rigor metodológico na coleta dos dados experimentais.

Entre os principais mecanismos implementados estão:

- resposta única por participante em cada tentativa
- exposição única de cartão por sessão
- relação **1:1 entre tentativa, consenso e consequência**
- rastreabilidade completa de todas as decisões registradas

A integridade experimental é garantida tanto **no nível da aplicação** quanto **no nível estrutural do banco de dados**.

---

# Como Rodar o Projeto

Em ambiente de desenvolvimento (GitHub Codespaces):

´´´
npm install
npm run dev
´´´


---

# Status do Projeto
[X] Modelagem de banco validada
[X] Implementação física do banco em PostgreSQL
[X] Arquitetura técnica definida

[ ] Setup do backend
[ ] Implementação dos endpoints principais
[ ] Integração com frontend
[ ] Deploy


---

# Autoras

Projeto desenvolvido como parte do **Projeto de Graduação em Computação**.

**Nayara Valéria Joca Gonçalves**  
**Amanda Magalhães Lima**
