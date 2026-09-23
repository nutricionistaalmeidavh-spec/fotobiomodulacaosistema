# F9 — Operação Clínica Completa

## Objetivo

Adicionar a camada operacional local da clínica — agenda, pacotes, financeiro e relatórios — sem alterar os invariantes clínicos das fases anteriores e sem dependência obrigatória de SaaS/API externa.

## Escopo canônico preservado

F9 cobre:

- agenda de sessões, retornos, recorrências e faltas;
- financeiro com procedimentos, pacotes, pagamentos, pendências e recibos;
- pacotes de tratamento e consumo de sessões;
- relatórios de pacientes, sessões, protocolos, evolução, receita, profissional e equipamento.

## Persistência

Nova migration F9 cria entidades operacionais separadas do prontuário clínico:

### Appointment

Campos mínimos:

- paciente;
- profissional opcional;
- início/fim;
- tipo `session|return|evaluation|other`;
- status `scheduled|confirmed|completed|missed|cancelled`;
- série recorrente opcional;
- observação operacional.

A recorrência é materializada em ocorrências explícitas; cada compromisso continua auditável individualmente.

### TreatmentPackage

Campos mínimos:

- paciente;
- nome;
- quantidade total de sessões;
- valor total em centavos;
- status `active|completed|cancelled`;
- validade opcional.

### PackageUsage

Vincula uma sessão PBM real a um pacote. Uma sessão não pode consumir o mesmo pacote duas vezes. Consumo não é inferido automaticamente.

### Payment

Campos mínimos:

- paciente;
- pacote opcional;
- valor em centavos;
- forma de pagamento;
- status `pending|paid|cancelled`;
- vencimento/pagamento;
- referência/observação.

Valores monetários são armazenados em centavos inteiros.

## Serviço e API

F9 compõe F8 e expõe operações locais para:

- listar/criar/alterar compromissos e status;
- criar/listar pacotes;
- consumir sessão explicitamente em pacote;
- criar/listar pagamentos e registrar quitação;
- gerar resumo operacional/financeiro por período.

Rotas principais:

- `GET|POST /api/appointments`;
- `PATCH /api/appointments/:id`;
- `GET|POST /api/packages`;
- `POST /api/packages/:id/consume`;
- `GET|POST /api/payments`;
- `POST /api/payments/:id/pay`;
- `GET /api/reports/operations`.

## Relatórios

O relatório por período retorna agregados descritivos, sem projeção automática:

- pacientes atendidos;
- compromissos por status;
- sessões PBM concluídas;
- protocolos utilizados;
- outcomes registrados;
- receita recebida e pendente;
- sessões por profissional;
- sessões por equipamento.

## UI

Adicionar navegação superior para:

- **Agenda**;
- **Financeiro**;
- **Relatórios**.

A UI deve permanecer responsiva, sem menu lateral e sem carrosséis horizontais no conteúdo principal.

## Auditoria

Toda mutação F9 registra ator, entidade, ID e, em alterações, snapshots `before` e `after` no payload de auditoria quando aplicável.

## Segurança e consistência

1. Agenda não cria automaticamente sessão clínica.
2. Marcar compromisso como concluído não cria aplicação PBM.
3. Consumo de pacote exige sessão real existente.
4. Pagamento e pacote não alteram prontuário/protocolo.
5. Relatórios são descritivos e não inferem eficácia clínica.
6. Nenhuma integração de pagamento externa é obrigatória.

## Critério de conclusão

- schema e serviços F9 testados;
- valores monetários validados em centavos inteiros;
- duplicidade de consumo impedida;
- API autenticada testada;
- UI Agenda/Financeiro/Relatórios exercitada em Chromium;
- regressão F0–F8 verde;
- runtime continua R$ 0/self-hosted.
