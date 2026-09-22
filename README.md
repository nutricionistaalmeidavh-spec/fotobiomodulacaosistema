# ArtiSys Fotobiomodulação

Sistema clínico especializado em fotobiomodulação, construído por etapas. A **F0 — Fundação técnica e domínio clínico** permanece concluída e protegida; em paralelo, este branch evolui a interface de **UI-0 até UI-6** sem declarar como persistidas funcionalidades clínicas cujo backend F1 ainda não existe.

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

### UI-0 / UI-1 / UI-2 — fundação visual, dashboard e workspace do paciente

A interface inclui:

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

### UI-3 — Anamnese, Consentimento e C09

A UI-3 acrescenta ao workspace do paciente:

- anamnese estruturada com queixa principal, objetivo do atendimento, medicações informadas e precauções/observações;
- rascunho local separado por paciente no provider de interface;
- consentimento informado com status local explícito;
- checklist C09 de segurança pré-sessão com confirmação de identidade/contexto, objetivo, precauções, local, equipamento e confirmação profissional;
- avisos explícitos de que o software não determina elegibilidade clínica e não realiza liberação automática.

**Limite atual:** anamnese, consentimento e C09 desta UI são **estado local de interface e não são persistidos no backend clínico**. A simulação de consentimento não representa assinatura digital nem comprovação jurídica.

### UI-4 — Protocolos + calculadora de dosimetria

A UI-4 mantém a biblioteca real de protocolos F0 e acrescenta uma calculadora transparente de relações físicas:

- energia: `J = (mW / 1000) × segundos`;
- fluência: `J/cm² = J / área`;
- tempo derivado quando energia e potência são informadas;
- validação de zero, negativos e valores não finitos para evitar `NaN`/`Infinity`;
- nenhuma sugestão automática de tratamento, protocolo ou parâmetro clínico.

**Limite atual:** a calculadora faz aritmética somente. Ela não grava parâmetros, não recomenda dose e não substitui decisão profissional. Os protocolos continuam usando o versionamento imutável real da F0.

### UI-5 — Workspace técnico de equipamentos

A UI-5 reorganiza os dados reais de `/api/equipment` em uma consulta técnica responsiva:

- fabricante/modelo e número de série;
- aplicador;
- comprimento de onda cadastrado;
- potência máxima cadastrada;
- indicador neutro de completude dos dados técnicos.

**Limite atual:** a interface não infere indicação, compatibilidade clínica nem adequação de equipamento a um tratamento.

### UI-6 — Atendimento/Sessão guiada

A UI-6 organiza o registro real de sessão F0 em cinco etapas:

1. **Planejamento** — versão exata do protocolo + energia planejada;
2. **Segurança** — checkpoint C09 local de interface;
3. **Aplicação** — energia efetivamente aplicada;
4. **Registro** — justificativa profissional quando aplicado ≠ planejado e gravação real em `/api/sessions`;
5. **Evolução** — histórico persistido das sessões F0.

Os campos das etapas permanecem no mesmo fluxo de interface ao navegar entre passos, e o backend continua protegendo a separação entre snapshot planejado e snapshot aplicado.

**Limite atual:** o checkpoint de segurança da UI-6 ainda é local e não é persistido; o registro final da sessão, por outro lado, usa o backend F0 real.

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
- Anamnese + Consentimento + C09 local com limites de persistência explícitos;
- calculadora de dosimetria e validação de entradas inválidas;
- biblioteca de protocolos versionados ao lado da calculadora;
- workspace técnico de equipamentos reais e mobile sem overflow global;
- fluxo guiado de sessão em cinco etapas;
- escrita real de sessão F0 e justificativa obrigatória para divergência planejado/aplicado;
- histórico persistido de sessões na etapa Evolução;
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
11. Fixtures/estado local de UI não podem ser confundidos com persistência clínica real.
12. Cálculos de dosimetria não podem ser apresentados como recomendação clínica.
13. Completude técnica de equipamento não pode ser apresentada como compatibilidade clínica.

## Roadmap

- **F0 — concluída:** fundação, domínio, persistência e invariantes clínicas.
- **UI-0/UI-1/UI-2 — frontend paralelo:** shell, dashboard, pacientes fixture-backed e workspace clínico visual.
- **UI-3/UI-4/UI-5/UI-6 — frontend paralelo:** intake clínico local, consentimento/C09, dosimetria aritmética, equipamentos reais e sessão F0 guiada.
- **F1 — backend ainda pendente:** autenticação local, paciente persistido, anamnese, prontuário/atendimento, consentimentos e histórico clínico correspondente.
- **F2:** protocolos PBM estruturados e regras de dosimetria persistidas quando aplicável.
- **F3:** equipamentos e adaptação determinística de parâmetros sem inferência clínica silenciosa.
- **F4:** marco MVP.
- **F5+:** evolução clínica, evidência, body map, operação completa e inteligência assistiva.

Documentação técnica adicional está em `docs/`.
