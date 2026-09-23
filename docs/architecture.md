# Arquitetura — F0 a F7

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
  ↓
F6 scientific evidence library
  ↓
F7 anatomical body map
```

O servidor atual instancia `createF7Service()`. O F7 compõe F6, que compõe F5 e toda a cadeia anterior. As rotas das fases anteriores permanecem disponíveis para regressão e compatibilidade.

## Persistência

`database.js` aplica as migrations SQL de `src/db/migrations` em ordem lexical e registra cada versão em `schema_migrations`.

Migrations atuais:

- `0001_f0.sql` — domínio clínico e auditoria base;
- `0002_f1.sql` — autenticação local e ciclo de paciente/atendimento;
- `0003_f2.sql` — metadados estruturados de protocolo/dosimetria;
- `0004_f3.sql` — capacidades estruturadas de equipamentos/aplicadores;
- `0005_f4.sql` — consentimento, mídia/documento e imutabilidade do MVP;
- `0006_f5.sql` — profissional responsável e agrupamento longitudinal em outcomes;
- `0007_f6.sql` — fontes científicas e vínculos a versões exatas de protocolo.

F7 não cria uma tabela paralela de localização. Ele reutiliza `application_points.coordinates_json` com um payload anatômico versionado (`schemaVersion: 1`).

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
- `application-points`: pontos/localizações efetivamente tratados, incluindo coordenadas F7;
- `outcomes`: evolução clínica e séries temporais;
- `clinical-media`: imagens clínicas e metadados de integridade;
- `consent`: aceite/revogação append-only;
- `documents`: PDF clínico finalizado e imutável;
- `evidence-library`: referências científicas locais pesquisáveis;
- `protocol-evidence`: vínculo explícito entre evidência e `ProtocolVersion` exata;
- `body-map`: catálogo anatômico determinístico e confirmação de localização pelo profissional;
- `backup`: snapshot SQLite consistente + arquivos + manifesto SHA-256;
- `audit`: cadeia append-only verificável.

## F6 — evidência científica

`evidence_sources` armazena metadados bibliográficos e clínicos estruturados. `protocol_evidence_links` vincula a referência a uma versão imutável de protocolo com relação `supports`, `context` ou `contradicts`.

A biblioteca é documental. Não calcula score terapêutico, não altera `ProtocolVersion`, não escolhe dose e não prescreve.

Rotas autenticadas:

- `GET /api/evidence`;
- `POST /api/evidence`;
- `GET /api/protocol-versions/:id/evidence`;
- `POST /api/protocol-versions/:id/evidence`.

## F7 — mapa corporal

O catálogo anatômico fica em `src/domain/body-map.js` e contém regiões determinísticas, vistas suportadas e centros normalizados. A confirmação do profissional produz um `ApplicationPoint` real com:

- região canônica;
- vista `anterior|posterior`;
- lateralidade;
- coordenadas `x/y` normalizadas entre 0 e 1;
- rótulo anatômico;
- sessão real e sequência.

Rotas autenticadas:

- `GET /api/body-map/catalog`;
- `POST /api/sessions/:id/body-map-points`;
- `GET /api/patients/:id/body-map-points`.

O mapa não possui regra de recomendação terapêutica ou seleção automática de ponto/dose.

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
- Evidência F6 permanece referência documental e não modifica o protocolo.
- Body map F7 apenas registra localização confirmada; não sugere conduta.

## Interface

O shell continua mobile-first com navegação superior. As novas superfícies são inseridas nos fluxos já existentes:

- F6 aparece em **Protocolos**, com cadastro, busca e vínculo de evidência;
- F7 aparece no **workspace do paciente**, com SVG anterior/posterior e pontos registrados em sessão;
- F5 permanece no workspace com formulário de desfecho, séries, comparação e timeline.

Não foi criado menu lateral nem uma arquitetura paralela para F6/F7.
