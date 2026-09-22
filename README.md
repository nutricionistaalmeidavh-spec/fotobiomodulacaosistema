# ArtiSys Fotobiomodulação

Sistema clínico especializado em fotobiomodulação, construído por etapas. O repositório começa com a **F0 — Fundação técnica e domínio clínico**, já exposta em uma UI local para que cada etapa futura possa ser validada também no navegador.

## Estado atual — F0

A F0 entrega:

- Node.js + SQLite local/self-hosted;
- 19 tabelas de domínio/migração;
- migrações versionadas e reaplicação segura;
- profissionais, pacientes, atendimentos, equipamentos e aplicadores como fundação relacional;
- protocolos com versões imutáveis;
- vínculo histórico sessão → versão exata do protocolo;
- parâmetros planejados e efetivamente aplicados como snapshots separados;
- justificativa profissional obrigatória quando o aplicado difere do planejado;
- auditoria append-only com cadeia SHA-256 verificável;
- servidor HTTP/API local sem dependência de framework externo;
- UI responsiva com menu superior para Dashboard, Pacientes, Protocolos, Equipamentos, Sessões e Auditoria;
- testes unitários, integração HTTP, contratos de UI e E2E em navegador.

A UI de **Pacientes** e **Equipamentos** na F0 expõe a estrutura já existente no domínio e usa registros demo locais. CRUD clínico completo de pacientes/anamnese pertence à F1; motor de dosimetria e compatibilidade de equipamentos pertence às fases F2/F3.

## Core R$ 0 / self-hosted / open source

O runtime não exige SaaS, API paga, banco gerenciado ou serviço externo.

- **Runtime:** Node.js 22+ e SQLite via `node:sqlite`.
- **Aplicação:** HTTP + HTML/CSS/JS nativos.
- **Licença do projeto:** MIT.
- **E2E:** Playwright, apenas como dependência de desenvolvimento open source.
- **CI no GitHub Actions:** conveniência opcional do repositório; não é dependência para executar o produto.

Nenhum recurso pago é necessário silenciosamente.

## Executar a aplicação

```bash
npm install
npm run dev
```

Abra `http://127.0.0.1:8788`.

O banco persistente padrão é criado em `data/fotobiomodulacao.sqlite`.

## Testes

```bash
npm run test:unit
npx playwright install chromium
npm run test:e2e
npm run check
npm run smoke
```

A suíte E2E verifica no navegador:

1. todas as áreas concluídas da F0 aparecem na navegação;
2. o dashboard informa as 19 tabelas e invariantes clínicas;
3. protocolo pode ser criado e receber v2 sem edição da v1;
4. sessão bloqueia alteração de parâmetro sem justificativa profissional;
5. sessão alterada é registrada com planejado e aplicado separados;
6. auditoria aparece como cadeia íntegra após ações reais da UI;
7. os seis módulos continuam alcançáveis em viewport mobile sem overflow global.

## Invariantes protegidas

1. Uma versão de protocolo nunca é sobrescrita ou apagada.
2. Alterações clínicas geram uma nova versão.
3. Uma sessão aponta para a versão exata utilizada.
4. Protocolo e versão vinculados à sessão precisam pertencer um ao outro.
5. Parâmetros planejados e aplicados são snapshots separados.
6. Se o profissional alterar parâmetros aplicados, deve registrar motivo.
7. Eventos de auditoria são append-only.
8. A cadeia de auditoria detecta adulteração.
9. Migrações são aplicadas apenas uma vez por banco.
10. Funcionalidades concluídas precisam continuar visíveis/operáveis na UI e cobertas por E2E.

## Roadmap

- **F0 — concluída:** fundação, domínio, persistência, UI de validação e E2E.
- **F1:** paciente, autenticação local, anamnese, prontuário/atendimento e histórico clínico.
- **F2:** protocolos PBM estruturados e dosimetria.
- **F3:** equipamentos e adaptação determinística de parâmetros.
- **F4:** marco MVP.
- **F5+:** evolução clínica, evidência, body map, operação completa e inteligência assistiva.

Documentação técnica adicional está em `docs/`.
