# F8 — Motor Clínico Avançado

## Objetivo

Ampliar a busca clínica sobre protocolos já versionados sem introduzir prescrição automática, IA, embeddings, RAG ou ranking terapêutico. A decisão final continua pertencendo ao profissional.

## Escopo canônico preservado

F8 cobre busca por condição/sintoma/região/objetivo, filtros por idade, equipamento/aplicador, comprimento de onda e área profissional, além da exposição explícita de contraindicações e precauções.

## Arquitetura

F8 compõe `createF7Service()` e mantém toda a cadeia F0–F7. A busca avançada opera exclusivamente sobre dados estruturados locais em SQLite.

### Busca determinística

Entrada suportada:

- `query` textual normalizada;
- condição;
- sintoma;
- região corporal;
- objetivo terapêutico;
- fase clínica;
- idade em anos;
- área profissional;
- comprimento de onda;
- aplicador real.

A busca não atribui score clínico e não ordena por “melhor protocolo”. Os resultados permanecem documentais e filtrados por correspondência explícita.

### Faixa etária e área profissional

`protocol_indications` passa a suportar:

- `min_age_years`;
- `max_age_years`;
- `professional_area`.

Uma indicação sem limite etário continua aplicável a qualquer idade. Uma indicação sem área profissional não restringe por profissão.

### Equipamento e comprimento de onda

O filtro por aplicador reutiliza a adaptação determinística já existente em F3. O protocolo de referência nunca é alterado. O filtro por comprimento de onda compara o parâmetro da `ProtocolVersion` e/ou a capacidade do aplicador sem inventar valores ausentes.

### Contraindicações e precauções

Cada resultado deve incluir a lista da versão exata em `protocol_contraindications`, com `label`, `severity`, `rationale` e `sourceReference`.

A UI mostra essas informações como checklist de revisão profissional. Marcar ou desmarcar itens não modifica o protocolo e não constitui autorização automática de uso.

## API

- `GET /api/clinical-engine/protocols`
  - aceita filtros F8;
  - retorna protocolo, versão atual, indicações, contraindicações e, quando houver aplicador, a compatibilidade determinística.

## UI

F8 estende a superfície de **Protocolos** com:

- painel “Busca clínica avançada”;
- filtros estruturados;
- resultados sem score/ranking;
- contraindicações/precauções visíveis;
- aviso explícito de que a decisão é profissional.

## Segurança clínica

1. Nenhum resultado é apresentado como recomendação automática.
2. Nenhuma dose é escolhida pelo sistema.
3. Nenhum parâmetro da versão científica/profissional é sobrescrito.
4. Incompatibilidade de equipamento é exibida, não corrigida silenciosamente.
5. Ausência de dado não pode ser convertida em valor presumido.
6. Busca textual é determinística e local.

## Critério de conclusão

- migrations F8 aplicadas uma única vez;
- busca avançada unitariamente testada;
- API autenticada testada;
- UI exercitada em Chromium;
- regressão F0–F7 verde;
- nenhum pacote/runtime de IA, embedding, banco vetorial ou API paga introduzido.
