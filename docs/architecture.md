# Arquitetura F0

## Princípio

O domínio clínico não conhece UI, Cloudflare, Supabase, APIs comerciais ou provedores de autenticação. Infraestrutura fica nas bordas.

```text
UI / Desktop / PWA
        ↓
Application services
        ↓
Clinical domain
        ↓
Ports / adapters
        ↓
SQLite / filesystem local
```

## Boundaries planejados

- `patients`: identidade e dados clínicos do paciente.
- `encounters`: atendimento/prontuário.
- `pbm-protocols`: definição e versionamento de protocolos.
- `pbm-equipment`: equipamento/aplicador e capacidades.
- `pbm-sessions`: aplicação real, pontos e parâmetros efetivos.
- `outcomes`: evolução e medidas.
- `clinical-media`: fotos, vídeos e anexos.
- `consent`: aceite, revogação e evidência.
- `documents`: documentos clínicos e PDF futuro.
- `audit`: trilha imutável.

## Decisões de segurança clínica

- O banco não modela protocolo como prescrição automática.
- A aplicação realizada é registrada independentemente da sugestão/protocolo.
- Alteração de parâmetros exige justificativa profissional.
- Evidência e fonte ficam associáveis à versão do protocolo.
- Histórico antigo não muda quando um protocolo recebe versão nova.

## Persistência

`database.js` aplica arquivos SQL de `src/db/migrations` em ordem lexical e registra cada versão em `schema_migrations` dentro de transação.

SQLite é o adaptador inicial por simplicidade, portabilidade e custo zero. A UI não acessa SQL diretamente; os serviços de aplicação concentram o acesso ao banco para permitir outro adaptador self-hosted no futuro.
