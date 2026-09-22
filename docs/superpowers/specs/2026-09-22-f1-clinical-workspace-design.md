# F1 — Workspace clínico

## Objetivo

Transformar a fundação F0 em um sistema clínico utilizável localmente: autenticação, cadastro de pacientes, anamnese, atendimento/prontuário e histórico longitudinal, preservando os invariantes de protocolos, sessões e auditoria.

## Restrições

- Core obrigatório R$ 0, self-hosted e open source.
- Nenhum OAuth, SaaS de autenticação, banco gerenciado ou API paga é necessário.
- Dados clínicos não usam localStorage/sessionStorage como fonte de verdade.
- Toda mutação clínica relevante gera auditoria com o profissional autenticado.
- Não há exclusão destrutiva de paciente; o fluxo é arquivamento.

## Autenticação local

- `auth_accounts` vincula credencial a `professionals`.
- Senhas são derivadas com `scrypt` do Node e salt aleatório por conta.
- `auth_sessions` guarda somente hash SHA-256 do token de sessão.
- Cookie de sessão: HttpOnly, SameSite=Strict, Path=/; `Secure` quando a aplicação estiver em HTTPS.
- Primeiro uso apresenta criação da conta administradora local; depois disso o endpoint de setup é bloqueado.
- APIs clínicas exigem sessão válida.

## Paciente

A F1 permite criar, editar e arquivar paciente. Campos básicos: nome, nascimento, documento, e-mail, telefone, contato de emergência e observações. Pacientes arquivados permanecem no banco e no histórico.

## Anamnese e atendimento

Um atendimento (`encounter`) pertence a um paciente e profissional autenticado. A criação de atendimento pode registrar uma anamnese (`assessment`) com queixa principal, história, medicamentos, alergias, precauções e escala de dor. Atendimento pode ser finalizado, preservando o conteúdo clínico já registrado.

## Histórico clínico

O workspace do paciente agrega cronologicamente:

- anamneses;
- atendimentos abertos/finalizados;
- sessões de fotobiomodulação vinculadas aos atendimentos;
- desfechos já suportados pela F0.

Sessões novas deixam de usar obrigatoriamente o atendimento demo e podem receber `encounterId` real.

## UI

Após autenticação, a navegação F0 é preservada. A tela Pacientes passa a conter:

1. busca/lista;
2. cadastro de paciente;
3. workspace do paciente selecionado;
4. edição cadastral;
5. formulário de anamnese + início de atendimento;
6. finalização de atendimento;
7. timeline clínica.

O Dashboard passa a indicar F1 concluída e métricas de pacientes/atendimentos, sem remover os cards de protocolo, sessão e auditoria.

## E2E obrigatório

A suíte deve comprovar em navegador:

1. primeiro setup da conta local;
2. logout e login com senha;
3. bloqueio de dados clínicos sem autenticação;
4. criação e edição de paciente pela UI;
5. criação de atendimento com anamnese;
6. finalização de atendimento;
7. histórico clínico visível após recarregar a página;
8. sessão vinculada a atendimento real aparece no histórico do paciente;
9. funcionalidades F0 continuam alcançáveis;
10. viewport mobile sem overflow global.
