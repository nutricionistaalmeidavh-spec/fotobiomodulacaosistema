# F6–F7 — Biblioteca científica e mapa corporal

## Posição no roadmap

Este documento detalha somente as fases canônicas já previstas como F6 (biblioteca científica/evidências) e F7 (anatomia/body map). Não altera a ordem F0–F11 e não introduz F8 ou fases posteriores.

## Restrições preservadas

- Core local/self-hosted e R$ 0, sem API paga obrigatória.
- Evidência científica é referência documental; não prescreve, não recomenda dose e não modifica parâmetros de ProtocolVersion.
- ProtocolVersion permanece imutável.
- Vínculos entre evidência e versão de protocolo são explícitos e auditados.
- O mapa corporal registra localização anatômica escolhida pelo profissional; não sugere ponto de aplicação nem dose.
- Pontos anatômicos reutilizam `application_points` e `coordinates_json`, preservando o histórico já criado pela F4.
- Auditoria permanece append-only.

## F6 — Biblioteca científica/evidências

### Objetivo

Adicionar uma biblioteca local pesquisável de referências científicas que possa ser vinculada a versões exatas de protocolo sem alterar o protocolo de referência.

### Persistência

`evidence_sources` registra:

- título;
- autores;
- ano de publicação;
- periódico/fonte;
- tipo de estudo;
- DOI e URL opcionais;
- resumo e notas;
- condições, regiões corporais e comprimentos de onda como metadados estruturados;
- estado `active|archived`;
- profissional criador e timestamp.

`protocol_evidence_links` registra:

- versão exata do protocolo;
- evidência;
- relação documental `supports|context|contradicts`;
- nota opcional;
- profissional e timestamp.

Não existe endpoint de atualização destrutiva de referência ou vínculo nesta fase.

### Serviço/API

- criar referência científica;
- listar/pesquisar por texto e filtros estruturados;
- vincular evidência a uma `ProtocolVersion` existente;
- listar referências vinculadas à versão;
- auditar criação e vínculo;
- expor HTTP autenticado em `/api/evidence` e `/api/protocol-versions/:id/evidence`.

### UI

Painel local de evidências integrado à área de protocolos, contendo cadastro, busca, lista e vínculo explícito a uma versão do protocolo. A UI não exibe score terapêutico, ranking, prescrição ou recomendação automática.

## F7 — Anatomia / body map

### Objetivo

Adicionar seleção anatômica visual e estruturada para registrar pontos reais de aplicação em sessões já existentes.

### Modelo

Catálogo anatômico local e determinístico com:

- vista `anterior|posterior`;
- região anatômica canônica;
- lateralidade `left|right|midline|bilateral`;
- coordenadas normalizadas `x` e `y` entre 0 e 1;
- rótulo anatômico opcional.

O registro é persistido no `application_points.coordinates_json` já existente. `body_region`, `anatomical_label`, `sequence_number` e `parameters_json` continuam preservados no mesmo registro de aplicação.

### Serviço/API

- catálogo anatômico;
- normalização/validação do ponto;
- registro de ponto de mapa corporal ligado a uma sessão real;
- listagem dos pontos de mapa corporal do paciente;
- extensão do workspace longitudinal;
- HTTP autenticado em `/api/body-map/catalog`, `/api/sessions/:id/body-map-points` e `/api/patients/:id/body-map-points`.

### UI

Mapa SVG local, sem dependências externas, com vista anterior/posterior, região selecionável, lateralidade, sequência, sessão e marcador visual. O profissional confirma e grava o ponto; não há sugestão automática.

## Gate de conclusão

F6 e F7 só são consideradas concluídas quando, sobre o mesmo commit final:

1. `npm run check` passa;
2. todos os unit/domain/HTTP passam;
3. E2E Chromium cobre criação/pesquisa/vínculo de evidência e registro visual de body-map;
4. smoke passa;
5. regressões F0–F5 continuam verdes;
6. nenhuma dependência runtime paga/externa é adicionada;
7. não há prescrição, dose automática ou mutação da versão científica do protocolo.
