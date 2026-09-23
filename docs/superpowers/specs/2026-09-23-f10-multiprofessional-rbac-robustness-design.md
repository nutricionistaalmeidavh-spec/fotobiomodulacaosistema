# F10 — Multi-profissional, RBAC e Robustez

## Objetivo

Fechar o roadmap funcional com operação multi-profissional local, autorização por papel, auditoria operacional mais explícita e ferramentas de integridade/backup/restauração, preservando o core self-hosted e os invariantes clínicos F0–F9.

## Escopo canônico preservado

F10 cobre:

- entidade Clínica;
- papéis Administrador, Profissional e Recepção;
- permissões distintas para prontuário, agenda, financeiro e protocolos;
- auditoria com quem/quando/ação/registro e snapshots anterior/posterior em alterações F9/F10;
- exportação/backup, restauração controlada e verificação de integridade;
- política local de retenção de mídia;
- gestão de permissões, sessões autenticadas e logs/auditoria.

## Clínica e membros

A instalação local possui uma clínica padrão e pode associar contas autenticadas a ela por `clinic_memberships`.

Papéis:

- `admin`;
- `professional`;
- `reception`.

A coluna legada `auth_accounts.role` permanece somente para compatibilidade; a autorização F10 usa o papel da membership quando existir.

## Matriz RBAC

Chaves canônicas:

- `patients.read` / `patients.write`;
- `clinical.read` / `clinical.write`;
- `agenda.read` / `agenda.write`;
- `finance.read` / `finance.write`;
- `protocols.read` / `protocols.write`;
- `equipment.read` / `equipment.write`;
- `audit.read`;
- `accounts.manage`;
- `backup.manage`.

Matriz padrão:

### Administrador

Todas as permissões.

### Profissional

- pacientes leitura/escrita;
- prontuário leitura/escrita;
- agenda leitura/escrita;
- protocolos leitura/escrita;
- equipamentos leitura;
- sem acesso financeiro administrativo, gestão de contas ou backup por padrão.

### Recepção

- pacientes leitura/escrita cadastral;
- agenda leitura/escrita;
- financeiro leitura/escrita;
- sem acesso a prontuário clínico, protocolos clínicos, auditoria ou backup.

Nenhuma permissão é derivada da UI. O servidor valida a autorização em cada rota protegida.

## Gestão de contas

Administrador pode criar contas locais para profissional/recepção com senha inicial explícita, ativar/desativar conta e alterar membership. Senhas continuam usando o mecanismo scrypt local existente.

## Sessões

- sessão autenticada permanece HttpOnly/SameSite=Strict;
- conta desativada deixa de autenticar imediatamente;
- administrador pode revogar todas as sessões de uma conta;
- listagem administrativa expõe metadados de sessão, nunca token/hash.

## Integridade e backup/restauração

### Verificação

`verifyOperationalIntegrity()` executa:

- `PRAGMA integrity_check`;
- validação da cadeia de auditoria;
- contagens de referências órfãs relevantes para agenda/pacotes/pagamentos.

### Backup/exportação

Reutiliza o backup F4 baseado em `VACUUM INTO` + manifesto SHA-256.

### Restauração

A restauração é uma operação administrativa controlada sobre um backup verificado. Para evitar substituir um banco aberto silenciosamente, o serviço prepara/restaura para um destino explícito e nunca sobrescreve o arquivo corrente sem caminho de destino informado.

## Retenção de mídia

A clínica pode definir `media_retention_days` opcional. F10 calcula quais mídias estão elegíveis para revisão de retenção; não apaga mídia clínica automaticamente. Exclusão física automática fica fora do escopo para evitar perda destrutiva.

## Auditoria/logs

F10 oferece consulta de auditoria filtrável por ator, ação, entidade e período. Tokens, hashes de senha e segredos nunca entram no payload de auditoria.

## API

- `GET /api/admin/clinic`;
- `GET|POST /api/admin/accounts`;
- `PATCH /api/admin/accounts/:id`;
- `POST /api/admin/accounts/:id/revoke-sessions`;
- `GET /api/admin/sessions`;
- `GET /api/admin/integrity`;
- `POST /api/admin/backups`;
- `POST /api/admin/restore-preview`;
- `GET /api/admin/audit`.

## UI

Adicionar superfície **Administração** apenas para administradores, contendo:

- clínica/política de retenção;
- contas e papéis;
- sessões;
- integridade;
- backups/restauração preparada;
- auditoria filtrável.

A navegação continua superior e responsiva.

## Critério de conclusão

- autorizações testadas em nível de serviço/HTTP;
- cenário admin permitido, profissional restrito e recepção bloqueada no prontuário;
- conta desativada e revogação de sessões testadas;
- integridade e restore-preview testados;
- UI administrativa E2E;
- regressão F0–F9 verde;
- nenhum segredo exposto;
- nenhum SaaS/API paga/IA/RAG introduzido.
