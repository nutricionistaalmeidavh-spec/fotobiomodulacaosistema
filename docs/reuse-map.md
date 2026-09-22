# Mapa de reaproveitamento para F1+

Nenhum módulo dos sistemas existentes foi copiado diretamente na F0. A fundação foi mantida independente para evitar transportar acoplamentos de produto, Supabase ou Cloudflare para o novo core.

| Origem | Reaproveitamento previsto | Estratégia |
|---|---|---|
| `frontEnds/library/clinic-ui-kit` | workspace do paciente, status, timeline e padrões de UI clínica | adaptar somente UI, sem regras de negócio antigas |
| `frontEnds` forms/dashboard/buttons kits | formulários, cards, ações e dashboards | reaproveitar componentes visuais |
| `frontEnds/shells/product-runtime` | conceitos de sessão/login | adaptar por porta de auth; não acoplar provider |
| `ConsulroriaAmamenta-o` | encounter, paciente, consentimento, documentos, PDF, mídia clínica, follow-up | extrair regras genéricas e trocar dependências específicas |
| `CLINICASMEDICAS` | workspace clínico e shell operacional | adaptar UI/fluxos |
| `Desknutri` | padrões de histórico e gestão clínica | reaproveitamento seletivo |
| `utilidades` | audit, backup, upload/capture, impressão, EventBus, relatórios | integrar por módulos isolados após verificar contratos |
| `SaaSGuardrails` | guardrails de produto/SaaS | usar na camada comercial, não no domínio clínico |

## Regra

Qualquer código reaproveitado deve passar por três filtros:

1. não introduzir dependência paga no core;
2. não importar estado global ou identidade clínica baseada em storage do navegador;
3. não alterar as invariantes F0 de versionamento, sessão e auditoria.
