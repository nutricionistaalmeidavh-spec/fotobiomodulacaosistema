# Mapa de reaproveitamento para UI-0/UI-2 e F1+

A F0 de domínio continuou independente. O frontend paralelo passou a **adaptar padrões visuais e de composição** já catalogados em `frontEnds`, sem transportar regras de negócio, branding de outro produto, Supabase, Cloudflare ou dependência paga para o core.

| Origem | Reaproveitamento aplicado | Estratégia no Fotobiomodulação |
|---|---|---|
| `frontEnds/library/clinic-ui-kit` | paciente como contexto, status semântico, alerta clínico, timeline, patient header e estados vazios | padrões reimplementados com tokens `--pbm-*` e componentes ES modules próprios |
| `frontEnds/library/forms-kit` | hierarquia de campos, grid de formulário, validação inline | aplicado ao modal de paciente e preparado para anamnese/atendimento |
| `frontEnds/library/dashboard-kit` | KPI cards, ações rápidas e seções operacionais | aplicado ao Dashboard fixture-backed |
| `frontEnds/library/tables-kit` | tabela operacional responsiva e estado vazio | aplicado ao diretório de Pacientes; desktop tabela, mobile linhas empilhadas |
| `frontEnds/library/navigation-kit` | topbar, item ativo e navegação sem acoplamento a roteador | adaptado para menu superior fino; sidebar clínica não foi copiada |
| `frontEnds/library/dialogs-kit` | modal, fechar, cancelar e confirmação explícita | aplicado ao cadastro local de paciente com `role="dialog"`/`aria-modal` |
| `frontEnds/library/feedback-kit` | alertas, loading/empty-state e feedback sem poluição visual | aplicado a estados vazios, flash e alerta clínico |
| `CLINICASMEDICAS` | conceito de workspace centrado no paciente | adaptado para `Resumo · Anamnese · Protocolos · Sessões · Evolução · Fotos · Documentos · Consentimentos` |
| `ConsulroriaAmamenta-o` | referência de agenda, paciente, consentimento e documentos | referência para fases seguintes; nenhuma regra específica foi copiada nesta entrega |
| `Desknutri` | padrões de histórico e gestão clínica | referência seletiva futura |
| `utilidades` | audit, backup, upload/capture, impressão, EventBus, relatórios | integrar por módulos isolados após verificar contratos |
| `SaaSGuardrails` | guardrails de produto/SaaS | usar na camada comercial, não no domínio clínico |

## O que foi deliberadamente evitado

- sidebar clínica como shell final;
- dependência de React/Tailwind apenas para reutilizar aparência;
- cópia de branding de outros produtos;
- estado clínico persistido em `localStorage`/`sessionStorage`;
- integração paga ou SaaS obrigatório;
- criação de endpoints/banco fictícios só para a UI parecer pronta;
- alteração das migrations, regras de protocolo, sessão ou auditoria F0.

## Provider de UI paralelo

`src/app/public/data/mock-provider.js` é uma fronteira temporária e explícita para Dashboard/Pacientes/Workspace. Ele usa fixtures determinísticas, devolve cópias dos dados e mantém novos pacientes somente em memória do navegador.

Objetivo: permitir que a interface e seus E2Es avancem antes do backend F1 sem acoplar views ao formato final da API. Quando F1 estiver disponível, a troca deve ocorrer no adapter/provider, não por reescrita das telas.

## Regra de reaproveitamento

Qualquer código ou padrão reaproveitado deve passar por estes filtros:

1. não introduzir dependência paga no core;
2. funcionar no caminho R$ 0 / self-hosted / open source;
3. não importar estado global ou identidade clínica baseada em storage do navegador;
4. não alterar as invariantes F0 de versionamento, sessão e auditoria;
5. adaptar design/tokens à identidade do Fotobiomodulação em vez de copiar branding;
6. manter E2Es que provem que a funcionalidade aparece e funciona na UI.
