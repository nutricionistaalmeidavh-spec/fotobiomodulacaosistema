# Arquitetura — F0 a F10

## Princípio

O núcleo permanece local/self-hosted e independente de SaaS, APIs comerciais ou provedores obrigatórios.

```text
UI web local
    ↓
HTTP server + RBAC
    ↓
application services F10 → ... → F0
    ↓
domínio clínico/operacional
    ↓
SQLite + filesystem local
```

## Composição por fase

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
F5 longitudinal outcomes + timeline
  ↓
F6 scientific evidence library
  ↓
F7 anatomical body map
  ↓
F8 deterministic advanced clinical search
  ↓
F9 agenda + packages + finance + reports
  ↓
F10 clinic memberships + RBAC + robustness
```

O servidor instancia `createF10Service()`. Cada fase compõe a anterior; rotas e invariantes F0–F9 permanecem cobertos por regressão.

## Persistência

`database.js` aplica migrations SQL em ordem lexical e registra cada versão em `schema_migrations`.

- `0001_f0.sql` — domínio clínico e auditoria;
- `0002_f1.sql` — autenticação local e paciente/atendimento;
- `0003_f2.sql` — protocolos/dosimetria estruturados;
- `0004_f3.sql` — equipamento/aplicadores;
- `0005_f4.sql` — consentimento, mídia e documento;
- `0006_f5.sql` — outcomes longitudinais;
- `0007_f6.sql` — evidência científica;
- F7 reutiliza `application_points.coordinates_json`, sem tabela paralela;
- `0008_f8.sql` — idade e área profissional em indicações;
- `0009_f9.sql` — agenda, pacotes, consumos e pagamentos;
- `0010_f10.sql` — clínica e memberships RBAC.

## Boundaries

### Clínicos

- `patients`, `assessments`, `encounters`;
- `protocols`, `protocol_versions`, `protocol_indications`, `protocol_contraindications`;
- `equipment`, `applicators`, adaptação determinística;
- `treatment_sessions`, `application_points`;
- `outcomes`, `clinical_media`, `consents`, `documents`;
- `evidence_sources`, `protocol_evidence_links`;
- catálogo/body map F7.

### F8 — motor clínico avançado

F8 consulta dados locais estruturados e retorna protocolo + versão exata + indicações + contraindicações + compatibilidade opcional do aplicador. Não existe camada de score, ranking ou seleção automática de conduta.

Rota principal:

- `GET /api/clinical-engine/protocols`.

### F9 — operação clínica

Entidades operacionais ficam separadas do prontuário:

- `appointments`;
- `treatment_packages`;
- `package_usages`;
- `payments`.

A recorrência de agenda gera ocorrências explícitas. Consumo de pacote exige sessão PBM real. Valores financeiros são inteiros em centavos. Relatórios são agregações descritivas.

Rotas:

- `/api/appointments`;
- `/api/packages`;
- `/api/payments`;
- `/api/reports/operations`.

### F10 — identidade organizacional e RBAC

`clinics` representa a clínica local. `clinic_memberships` liga uma `auth_account` à clínica e define o papel efetivo:

- `admin`;
- `professional`;
- `reception`.

`auth_accounts.role` permanece apenas por compatibilidade; autorização F10 usa a membership ativa. O servidor resolve a permissão antes de executar a rota.

Permissões canônicas:

- pacientes: `patients.read/write`;
- prontuário: `clinical.read/write`;
- agenda: `agenda.read/write`;
- financeiro: `finance.read/write`;
- protocolos: `protocols.read/write`;
- equipamentos: `equipment.read/write`;
- administração: `audit.read`, `accounts.manage`, `backup.manage`.

A UI adapta a navegação ao papel, mas esconder controles **não** é mecanismo de segurança: o backend continua sendo a autoridade.

## Robustez F10

`verifyOperationalIntegrity()` agrega:

- `PRAGMA integrity_check`;
- verificação da cadeia SHA-256 de auditoria;
- contagem de referências operacionais órfãs.

Backup administrativo reutiliza `VACUUM INTO`, arquivos locais e manifesto SHA-256. `previewRestore()` exige backup verificado e destino explícito e não sobrescreve o banco aberto.

A política `media_retention_days` apenas identifica registros elegíveis para revisão. Não existe deleção automática de mídia clínica.

## Segurança clínica

- sem prescrição ou escolha automática de dose;
- protocolo de referência imutável;
- parâmetros planejados/aplicados separados;
- potência variável escolhida explicitamente pelo profissional;
- evidência F6 documental;
- body map F7 apenas registra localização;
- busca F8 determinística e sem ranking terapêutico;
- agenda F9 não cria aplicação PBM;
- financeiro F9 não altera prontuário;
- autorização F10 é server-side;
- segredos, hashes de senha e hashes de tokens não são expostos em APIs ou auditoria.

## Interface

A navegação continua superior e responsiva.

- F6/F8: **Protocolos**;
- F7/F5/F4: workspace do paciente;
- F9: **Agenda**, **Financeiro**, **Relatórios**;
- F10: **Administração**, visível ao administrador.

Para Recepção, a interface limita o workspace do paciente a dados cadastrais e não requisita prontuário/protocolos. Para Profissional, módulos financeiros/administrativos sem permissão são ocultados e continuam bloqueados no servidor.

## Roadmap

A arquitetura funcional termina em F10. Não há fase F11 substituta planejada. A decisão de produto está em `docs/decisions/0002-roadmap-ends-f10-no-ai-rag.md`.
