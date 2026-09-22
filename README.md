# ArtiSys Fotobiomodulação

Sistema clínico especializado em fotobiomodulação, construído por etapas. A **F0 — Fundação técnica e domínio clínico** permanece concluída e protegida; em paralelo, este branch acrescenta a fundação visual **UI-0**, o fluxo **UI-1 (Dashboard + Pacientes)** e o **UI-2 (Workspace do paciente)** sem declarar o backend clínico F1 como concluído.

## Estado atual

### F0 — fundação clínica persistida

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
- servidor HTTP/API local sem dependência de framework externo.

### UI-0 / UI-1 / UI-2 — frontend em paralelo

A interface atual acrescenta:

- shell responsivo com navegação superior compacta;
- rotas primárias: Dashboard, Pacientes, Agenda, Protocolos, Equipamentos, Relatórios e Configurações;
- Sessões F0 e Auditoria preservadas como ferramentas secundárias alcançáveis;
- tokens semânticos próprios para superfície, texto, borda, sucesso, alerta, perigo e informação;
- dashboard operacional com sessões do dia, pacientes ativos, retornos pendentes, protocolos recentes, ações rápidas e atividade recente;
- diretório de pacientes com busca sem distinção de maiúsculas/minúsculas ou acentos, filtro de status e estado vazio intencional;
- modal acessível de criação de paciente **somente no provider local de interface**;
- escape de texto para impedir que nomes com aparência de HTML sejam executados como markup;
- workspace centrado no paciente com oito abas locais: Resumo, Anamnese, Protocolos, Sessões, Evolução, Fotos, Documentos e Consentimentos;
- resumo do paciente com alerta clínico, protocolo atual, última/próxima sessão, pendências e timeline;
- estados vazios explícitos em áreas ainda sem persistência real;
- Agenda, Relatórios e Configurações como superfícies planejadas não vazias, sem simular persistência inexistente.

**Importante:** o Dashboard/Pacientes/Workspace novos usam fixtures determinísticas e um provider em memória para permitir desenvolvimento paralelo. Criar um paciente nessa UI não grava no SQLite e não significa que o CRUD clínico F1 esteja pronto. Protocolos, Equipamentos, Sessões F0 e Auditoria continuam usando a API/banco reais já existentes.

## Core R$ 0 / self-hosted / open source

O runtime não exige SaaS, API paga, banco gerenciado ou serviço externo.

- **Runtime:** Node.js 22+ e SQLite via `node:sqlite`.
- **Aplicação:** HTTP + HTML/CSS/JS nativos.
- **Frontend paralelo:** ES modules nativos + provider local; sem build system ou serviço externo obrigatório.
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

A cobertura automatizada inclui:

- contratos de domínio e persistência F0;
- imutabilidade de versões de protocolo;
- separação planejado/aplicado e justificativa profissional;
- integridade da cadeia de auditoria;
- contratos dos módulos de UI e do provider local;
- navegação global e ferramentas F0;
- dashboard operacional;
- busca/filtro de pacientes;
- estado vazio e limpeza de busca;
- modal de paciente, validação, cancelar/fechar e criação em memória;
- renderização literal de conteúdo com aparência de HTML;
- identidade do paciente e as oito abas do workspace;
- alerta clínico, protocolo atual, pendências e timeline;
- estados vazios de Fotos, Documentos e Consentimentos;
- navegação mobile por teclado, fechamento do menu após seleção e ausência de overflow global;
- superfícies planejadas sem persistência fictícia.

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
11. Fixtures de UI não podem ser confundidas com persistência clínica real.

## Roadmap

- **F0 — concluída:** fundação, domínio, persistência e invariantes clínicas.
- **UI-0/UI-1/UI-2 — frontend paralelo entregue neste branch:** shell, dashboard, pacientes fixture-backed e workspace clínico visual com E2E.
- **F1 — backend ainda pendente:** autenticação local, paciente persistido, anamnese, prontuário/atendimento e histórico clínico.
- **F2:** protocolos PBM estruturados e dosimetria.
- **F3:** equipamentos e adaptação determinística de parâmetros.
- **F4:** marco MVP.
- **F5+:** evolução clínica, evidência, body map, operação completa e inteligência assistiva.

Documentação técnica adicional está em `docs/`.
