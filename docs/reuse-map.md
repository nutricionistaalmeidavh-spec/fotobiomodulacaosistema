# Mapa de reaproveitamento para UI-0/UI-8 e F1+

A F0 de domínio continua independente. O frontend paralelo **adapta padrões visuais e de composição** já catalogados em `frontEnds`, sem transportar regras de negócio, branding de outro produto, Supabase, Cloudflare ou dependência paga para o core.

| Origem | Reaproveitamento aplicado | Estratégia no Fotobiomodulação |
|---|---|---|
| `frontEnds/library/clinic-ui-kit` | paciente como contexto, status semântico, alerta clínico, timeline, patient header e estados vazios | padrões reimplementados com tokens `--pbm-*` e componentes ES modules próprios |
| `frontEnds/library/forms-kit` | hierarquia de campos, grid de formulário, validação inline | aplicado a pacientes, intake, Evolução, Fotos, Agenda e filtros operacionais |
| `frontEnds/library/dashboard-kit` | KPI cards, ações rápidas e seções operacionais | aplicado ao Dashboard e aos Relatórios operacionais |
| `frontEnds/library/tables-kit` | tabela operacional responsiva e estado vazio | aplicado ao diretório de Pacientes e listagens; desktop tabela, mobile linhas empilhadas |
| `frontEnds/library/navigation-kit` | topbar, item ativo e navegação sem acoplamento a roteador | adaptado para menu superior fino; sidebar clínica não foi copiada |
| `frontEnds/library/dialogs-kit` | modal, fechar, cancelar e confirmação explícita | aplicado ao cadastro local de paciente e confirmação de remoção de foto |
| `frontEnds/library/feedback-kit` | alertas, loading/empty-state e feedback sem poluição visual | aplicado a estados vazios, flash, validações e alerta clínico |
| `CLINICASMEDICAS` | conceito de workspace centrado no paciente | adaptado para `Resumo · Anamnese · Protocolos · Sessões · Evolução · Fotos · Documentos · Consentimentos` |
| `ConsulroriaAmamenta-o` | referência de agenda, paciente, consentimento e documentos | conceito de agenda adaptado sem copiar regras específicas ou backend |
| `Desknutri` | padrões de histórico e gestão clínica | referência seletiva futura |
| `utilidades` | audit, backup, upload/capture, impressão, EventBus, relatórios | integrar somente por módulos isolados e contratos explícitos |
| `SaaSGuardrails` | guardrails de produto/SaaS | usar na camada comercial, não no domínio clínico |

## O que foi deliberadamente evitado

- sidebar clínica como shell final;
- dependência de React/Tailwind apenas para reutilizar aparência;
- cópia de branding de outros produtos;
- estado clínico persistido em `localStorage`/`sessionStorage`;
- integração paga ou SaaS obrigatório;
- criação de endpoints/banco fictícios só para a UI parecer pronta;
- acesso HTTP direto a partir das features;
- fallback silencioso de uma escrita persistida para memória local;
- alteração das migrations, regras de protocolo, sessão ou auditoria F0.

## Fronteira de dados backend-ready

`src/app/public/data/clinical-data-gateway.js` é a fronteira única consumida pelas views. O antigo `data/mock-provider.js` foi retirado para evitar uma segunda abstração concorrente.

O gateway combina capacidades sem esconder a origem dos dados:

- `F0ApiAdapter`: protocolos, equipamentos, sessões e auditoria persistidos;
- `LocalClinicalAdapter`: pacientes/intake, Evolução, Fotos e Agenda em memória da sessão da UI;
- relatório operacional: derivado pelo gateway das fontes atuais, com adapter substituível no futuro.

Todos os métodos expostos para a UI seguem contrato assíncrono. A intenção é permitir a substituição gradual de cada capability local por persistência real sem reescrever Dashboard, workspace, Agenda, Relatórios ou outras telas.

## Regra de reaproveitamento

Qualquer código ou padrão reaproveitado deve passar por estes filtros:

1. não introduzir dependência paga no core;
2. funcionar no caminho R$ 0 / self-hosted / open source;
3. não importar estado global ou identidade clínica baseada em storage persistente do navegador;
4. não alterar as invariantes F0 de versionamento, sessão e auditoria;
5. adaptar design/tokens à identidade do Fotobiomodulação em vez de copiar branding;
6. manter source semantics explícito entre `local` e `persisted`;
7. manter E2Es que provem que a funcionalidade aparece e funciona na UI.
