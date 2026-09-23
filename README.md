# ArtiSys Fotobiomodulação

Sistema clínico especializado em fotobiomodulação, construído por etapas. A **F0 — Fundação técnica e domínio clínico** permanece concluída e protegida; em paralelo, a interface avançou de **UI-0 até UI-8** com uma fronteira única de dados e sem declarar como persistidas funcionalidades cujo backend clínico ainda não existe.

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
- Sessões F0 e Auditoria como ferramentas secundárias alcançáveis;
- tokens semânticos próprios para superfície, texto, borda, sucesso, alerta, perigo e informação;
- dashboard operacional com sessões do dia, pacientes ativos, retornos pendentes, protocolos recentes, ações rápidas e atividade recente;
- diretório de pacientes com busca sem distinção de maiúsculas/minúsculas ou acentos, filtro de status e estado vazio intencional;
- cadastro acessível de paciente somente no estado local de interface;
- escape de texto para impedir execução de conteúdo com aparência de HTML;
- workspace centrado no paciente com Resumo, Anamnese, Protocolos, Sessões, Evolução, Fotos, Documentos e Consentimentos;
- resumo do paciente com alerta clínico, protocolo atual, última/próxima sessão, pendências e timeline.

### UI-3 — Anamnese, Consentimento e C09

- anamnese estruturada com queixa principal, objetivo, medicações e precauções/observações;
- rascunho local separado por paciente;
- consentimento informado com status local explícito;
- checklist C09 de segurança pré-sessão;
- nenhum mecanismo de liberação clínica automática.

**Limite atual:** anamnese, consentimento e C09 são estado local de interface. A simulação de consentimento não representa assinatura digital nem comprovação jurídica.

### UI-4 — Protocolos + calculadora de dosimetria

A UI-4 mantém a biblioteca persistida de protocolos F0 e acrescenta uma calculadora transparente de relações físicas:

- energia: `J = (mW / 1000) × segundos`;
- fluência: `J/cm² = J / área`;
- tempo derivado quando energia e potência são informadas;
- validação de zero, negativos e valores não finitos;
- nenhuma sugestão automática de tratamento, protocolo ou parâmetro clínico.

**Limite atual:** a calculadora faz aritmética somente. Ela não recomenda dose e não substitui decisão profissional.

### UI-5 — Workspace técnico de equipamentos

A UI-5 apresenta dados persistidos de equipamentos por meio do gateway:

- fabricante/modelo e número de série;
- aplicador;
- comprimento de onda cadastrado;
- potência máxima cadastrada;
- indicador neutro de completude técnica.

**Limite atual:** completude técnica não significa indicação nem compatibilidade clínica.

### UI-6 — Atendimento/Sessão guiada

A UI-6 organiza o registro real de sessão F0 em cinco etapas:

1. **Planejamento** — versão exata do protocolo + energia planejada;
2. **Segurança** — checkpoint C09 local de interface;
3. **Aplicação** — energia efetivamente aplicada;
4. **Registro** — justificativa profissional quando aplicado ≠ planejado e escrita persistida;
5. **Evolução** — histórico persistido das sessões F0.

Os campos permanecem no mesmo fluxo ao navegar entre etapas. O backend continua protegendo a separação entre snapshot planejado e snapshot aplicado.

### UI-7 — Evolução e Fotos

A UI-7 completa duas abas do workspace do paciente sem fingir persistência clínica inexistente:

- **Evolução:** registros locais por paciente, categoria e data, com filtros e estado vazio intencional;
- **Fotos:** seleção somente de `image/*`, limite de 5 MiB, preview local em memória/Data URL e metadados locais;
- remoção de foto somente após confirmação;
- avisos explícitos de que essas informações ainda não foram enviadas ao backend.

### UI-8 — Agenda, Relatórios e Auditoria modular

A UI-8 acrescenta:

- **Agenda local:** criação de compromisso, paciente vinculado, data/hora, observação, filtro e atualização de status;
- abertura direta do workspace do paciente a partir da Agenda;
- **Relatórios operacionais:** sessões no período, pacientes ativos, retornos pendentes, divergências planejado × aplicado e uso por protocolo;
- filtro de período com validação de intervalo invertido;
- relatórios estritamente descritivos, sem escore de eficácia ou recomendação clínica;
- **Auditoria:** visualização persistida da cadeia F0 por meio do gateway, com filtros por ação/entidade e hash visível.

Configurações continua sendo uma fronteira planejada explícita, sem persistência fictícia.

## Fronteira única de dados

A UI consome `ClinicalDataGateway`. Todas as operações do gateway são baseadas em `Promise`, inclusive recursos hoje locais, para que adapters futuros possam trocar a fonte sem reescrever as telas.

Somente `F0ApiAdapter` conhece os endpoints HTTP atuais. Features de UI não acessam `/api/...` diretamente e uma falha de escrita persistida **não** faz fallback silencioso para estado local.

| Capacidade | Fonte atual | Caminho de substituição |
|---|---|---|
| Protocolos / versões | Persistido F0 SQLite API | `F0ApiAdapter` |
| Equipamentos | Persistido F0 SQLite API | `F0ApiAdapter` |
| Sessões | Persistido F0 SQLite API | `F0ApiAdapter` |
| Auditoria | Persistido F0 SQLite API | `F0ApiAdapter` |
| Pacientes / intake | Memória da sessão da UI | substituir capability do adapter local |
| Evolução | Memória da sessão da UI | implementar adapter persistido de evolução |
| Fotos | Metadados locais + preview Data URL | implementar API de metadados + adapter de object storage |
| Agenda | Memória da sessão da UI | implementar adapter persistido de agenda |
| Relatórios | Derivados pelo gateway das fontes disponíveis | adapter de relatórios persistido opcional |

## Core R$ 0 / self-hosted / open source

O runtime não exige SaaS, API paga, banco gerenciado ou serviço externo.

- **Runtime:** Node.js 22+ e SQLite via `node:sqlite`.
- **Aplicação:** HTTP + HTML/CSS/JS nativos.
- **Frontend:** ES modules nativos; sem build system obrigatório.
- **Licença:** MIT.
- **E2E:** Playwright como dependência de desenvolvimento open source.
- **CI no GitHub Actions:** conveniência opcional; não é dependência para executar o produto.

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
- fronteira única do gateway e ausência de endpoints HTTP nas features;
- source semantics `local` × `persisted`;
- dashboard, pacientes e workspace;
- Anamnese + Consentimento + C09 local;
- calculadora de dosimetria;
- equipamentos persistidos e layout mobile;
- fluxo guiado de sessão e escrita real F0;
- Evolução local com filtros;
- Fotos com validação de tipo/tamanho, preview local e remoção confirmada;
- Agenda local com criação, filtro, status e vínculo ao paciente;
- Relatórios operacionais e validação de período;
- Auditoria persistida filtrável pelo gateway;
- travessia das rotas em desktop e mobile sem overflow global.

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
11. Estado local de UI não pode ser confundido com persistência clínica real.
12. Cálculos de dosimetria não podem ser apresentados como recomendação clínica.
13. Completude técnica de equipamento não pode ser apresentada como compatibilidade clínica.
14. Relatórios operacionais não podem ser apresentados como avaliação de eficácia clínica.
15. Falhas de escrita persistida não podem ser convertidas em sucesso local silencioso.

## Roadmap

- **F0 — concluída:** fundação, domínio, persistência e invariantes clínicas.
- **UI-0 → UI-8 — frontend paralelo concluído nesta etapa:** shell, dashboard, pacientes/workspace, intake, dosimetria, equipamentos, sessão guiada, Evolução, Fotos, Agenda, Relatórios e Auditoria modular.
- **F1 — backend ainda pendente:** autenticação local, paciente persistido, anamnese, prontuário/atendimento, consentimentos, Evolução, Fotos e Agenda persistidos.
- **F2:** protocolos PBM estruturados e regras de dosimetria persistidas quando aplicável.
- **F3:** equipamentos e adaptação determinística de parâmetros sem inferência clínica silenciosa.
- **F4:** marco MVP.
- **F5+:** evolução clínica avançada, evidência, body map, operação completa e inteligência assistiva.

Documentação técnica adicional está em `docs/`.
