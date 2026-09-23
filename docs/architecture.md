# Arquitetura — F0 a F5

## Princípio

O núcleo clínico permanece local e independente de SaaS, APIs comerciais ou provedores obrigatórios. Infraestrutura fica nas bordas.

```text
UI web local
    ↓
HTTP server / application services
    ↓
Clinical domain
    ↓
SQLite + filesystem local
```

## Composição por fase

A aplicação evolui por composição, preservando os contratos validados das fases anteriores:

```text
F0 foundation
  ↓
F1 clinical workspace / auth
  ↓
F2 protocol engine
  ↓
F3 equipment + deterministic adaptation
  ↓
F4 consent + media + PDF + backup
  ↓
F4 MVP service + application points
  ↓
F5 longitudinal outcomes + timeline
```

O servidor atual instancia `createF5Service()`, que compõe sobre o serviço MVP F4. As rotas das fases anteriores permanecem disponíveis para regressão e compatibilidade.

## Persistência

`database.js` aplica as migrations SQL de `src/db/migrations` em ordem lexical e registra cada versão em `schema_migrations`.

Migrations atuais:

- `0001_f0.sql` — domínio clínico e auditoria base;
- `0002_f1.sql` — autenticação local e ciclo de paciente/atendimento;
- `0003_f2.sql` — metadados estruturados de protocolo/dosimetria;
- `0004_f3.sql` — capacidades estruturadas de equipamentos/aplicadores;
- `0005_f4.sql` — consentimento, mídia/documento e imutabilidade do MVP;
- `0006_f5.sql` — profissional responsável e agrupamento longitudinal em outcomes.

SQLite usa `node:sqlite`. A UI não acessa SQL diretamente; todo acesso passa pelos serviços de aplicação.

## Boundaries implementados

- `patients`: identidade clínica, edição controlada e arquivamento não destrutivo;
- `assessments`: anamnese/avaliação clínica;
- `encounters`: ciclo do atendimento;
- `pbm-protocols`: protocolos e versões imutáveis;
- `protocol-indications`: condição, sintoma, região, objetivo e fase clínica;
- `pbm-equipment`: equipamentos, aplicadores e capacidades;
- `equipment-adaptation`: comparação protocolo de referência × equipamento selecionado;
- `pbm-sessions`: aplicação real com snapshots planejado/aplicado;
- `application-points`: pontos/localizações efetivamente tratados;
- `outcomes`: evolução clínica e séries temporais;
- `clinical-media`: imagens clínicas e metadados de integridade;
- `consent`: aceite/revogação append-only;
- `documents`: PDF clínico finalizado e imutável;
- `backup`: snapshot SQLite consistente + arquivos + manifesto SHA-256;
- `audit`: cadeia append-only verificável.

## Arquivos locais

Imagens e PDFs são gravados sob um `storageRoot` configurável. Registros persistem caminho controlado, metadados e SHA-256.

O backup usa `VACUUM INTO` para criar um snapshot consistente do SQLite aberto, copia os arquivos clínicos e gera `manifest.json` com tamanho e SHA-256 de cada arquivo. A verificação detecta arquivo ausente, tamanho divergente ou hash divergente.

## Segurança clínica

- O sistema não prescreve nem seleciona dose automaticamente.
- Dosimetria é matemática determinística baseada nos parâmetros fornecidos pelo profissional.
- Aplicador com potência variável exige seleção explícita da potência.
- A adaptação de equipamento nunca sobrescreve o protocolo de referência.
- ProtocolVersion é imutável.
- Sessões guardam versão exata do protocolo e parâmetros planejados/aplicados separados.
- Mudança entre planejado e aplicado exige justificativa profissional.
- Consentimentos preservam histórico append-only.
- Documentos finalizados são imutáveis.
- Auditoria é append-only e encadeada por hash.
- Evolução F5 compara registros descritivamente; não infere causalidade nem diagnóstico.

## Interface e API

O shell continua mobile-first com navegação superior. F5 acrescenta ao workspace real do paciente:

- formulário de desfecho;
- grupos longitudinais;
- série temporal;
- comparação primeiro → último;
- gráfico SVG local;
- timeline clínica única com avaliações, sessões, mídia, documentos, consentimentos e outcomes.

As rotas F5 relevantes são autenticadas e incluem:

- `GET/POST /api/patients/:id/outcomes`;
- `GET /api/patients/:id/outcome-series`;
- `GET /api/patients/:id/timeline`.

Rotas F0–F4 permanecem ativas e cobertas por regressão automatizada.
