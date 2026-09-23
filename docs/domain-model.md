# Modelo de domínio — F0 a F7

## Núcleo clínico

### Professional
Profissional responsável por avaliações, sessões, consentimentos, documentos, outcomes, vínculos de evidência e eventos auditáveis.

### Patient
Raiz do histórico clínico. Possui dados cadastrais, estado ativo/arquivado e relacionamentos com avaliações, atendimentos, sessões, mídia, evolução e pontos anatômicos aplicados.

### Assessment
Avaliação/anamnese vinculada ao paciente e ao atendimento. Guarda queixa principal, histórico, medicações, alergias, precauções, escore de dor e notas clínicas.

### Encounter
Atendimento clínico com início/finalização. Sessões PBM, documentos, mídia, outcomes e pontos de aplicação podem ser relacionados ao atendimento direta ou indiretamente.

## Fotobiomodulação

### Protocol
Identidade estável de um protocolo clínico.

### ProtocolVersion
Snapshot imutável do protocolo. Uma mudança clínica gera nova versão; versões anteriores nunca são sobrescritas.

Os parâmetros PBM podem incluir comprimento de onda, potência, tempo, área, energia, fluência, irradiância, modo, frequência, quantidade de pontos e técnica.

### ProtocolIndication
Relaciona a versão do protocolo a condição, sintoma, região corporal, objetivo terapêutico e fase clínica.

### ProtocolContraindication
Precaução/contraindicação rastreável por versão.

### Equipment
Equipamento físico real, com fabricante, modelo, série, observações/limitações e estado ativo.

### Applicator
Aplicador/ponteira de um equipamento. Registra comprimento de onda, potência fixa ou faixa de potência, área/spot, modos e frequências suportadas.

### Equipment adaptation
Não é uma nova versão do protocolo. É um cálculo derivado e separado que compara:

- `referenceParameters` — valores imutáveis da ProtocolVersion;
- `equipmentDerivedParameters` — valores matematicamente derivados para o equipamento selecionado;
- `warnings` — incompatibilidades ou dados faltantes.

Quando a potência é variável, a escolha da potência pertence ao profissional.

### TreatmentSession
Registro da aplicação realizada. Mantém protocolo/versão exatos e snapshots `planned_parameters_json` e `applied_parameters_json` separados. Divergência clínica relevante exige justificativa profissional.

### ApplicationPoint
Ponto/local individual tratado durante uma sessão. Registra sequência, região/anatomia textual, coordenadas estruturadas opcionais e parâmetros da aplicação. O histórico é imutável.

Na F7, `coordinates_json` recebe um payload anatômico versionado:

- `schemaVersion: 1`;
- `regionId` canônico;
- `view` (`anterior` ou `posterior`);
- `laterality`;
- `x` e `y` normalizados entre 0 e 1.

O mapa corporal não cria uma entidade terapêutica separada: ele confirma a localização de um `ApplicationPoint` real de uma sessão real.

## Governança e MVP clínico

### Consent
Evento de consentimento versionado. Aceite e revogação são registros append-only; o histórico não é sobrescrito.

### ClinicalMedia
Imagem clínica armazenada em filesystem local. O banco guarda vínculo clínico, nome original, MIME, tamanho, caminho e SHA-256.

### Document
Documento clínico. PDFs de atendimento podem ser finalizados localmente, armazenados com SHA-256 e tornam-se imutáveis quando finalizados.

### Backup
Exportação operacional do banco e arquivos clínicos. O snapshot SQLite é criado com `VACUUM INTO`, acompanhado por `manifest.json` com tamanho/hash de cada arquivo e verificação de integridade.

## Evolução longitudinal F5

### Outcome
Registro clínico temporal associado ao paciente e, quando aplicável, a atendimento e sessão.

Campos relevantes:

- `patient_id`;
- `encounter_id` opcional;
- `treatment_session_id` opcional;
- `professional_id`;
- `metric_type`;
- `metric_value`;
- `metric_unit`;
- `narrative`;
- `baseline_group` opcional;
- `measured_at`.

Tipos canônicos implementados:

- `vas_pain` — valor de 0 a 10, unidade canônica `0-10`;
- `functional_numeric` — valor numérico finito, unidade opcional;
- `edema` — valor numérico finito com unidade obrigatória;
- `rom` — valor numérico finito, unidade padrão `deg`;
- `text` — narrativa obrigatória, sem valor numérico.

`baseline_group` permite agrupar registros comparáveis de uma mesma métrica. O serviço F5 gera a série ordenada, primeiro valor, último valor e variação absoluta. Esses resultados são descritivos e não representam inferência causal.

### Patient timeline
A timeline agrega eventos clínicos persistidos, incluindo avaliações/atendimentos, sessões PBM, consentimentos, mídia, documentos, outcomes e pontos de aplicação, mantendo ordenação temporal e identidade dos registros.

## Biblioteca científica F6

### EvidenceSource
Referência científica armazenada localmente. Pode registrar:

- título;
- autores;
- ano de publicação;
- fonte/periódico;
- tipo de estudo;
- DOI e URL;
- resumo;
- condições clínicas estruturadas;
- regiões corporais estruturadas;
- comprimentos de onda relacionados.

A entidade é documental. Sua presença não altera parâmetros clínicos nem representa recomendação de tratamento.

### ProtocolEvidenceLink
Vínculo explícito entre uma `EvidenceSource` e uma `ProtocolVersion` exata.

Relações suportadas:

- `supports` — referência documentada como suporte;
- `context` — referência contextual;
- `contradicts` — referência documentada como evidência divergente/contrária.

O vínculo possui nota opcional, é auditável e nunca modifica a `ProtocolVersion` relacionada.

## Mapa corporal F7

### BodyMapRegion
Entrada de catálogo anatômico determinístico mantida no domínio. Define identificador canônico, rótulo, vistas suportadas e centros normalizados para representação SVG.

Não contém dose, energia, protocolo recomendado nem regra de decisão terapêutica.

### BodyMapPoint
Não é uma tabela nova. É a interpretação F7 de um `ApplicationPoint` que contém coordenadas anatômicas estruturadas e foi confirmado pelo profissional em uma sessão PBM existente.

## Auditoria

### AuditEvent
Evento append-only com `prev_hash` e `event_hash` para cadeia SHA-256 verificável. Ações clínicas relevantes registram profissional, entidade, payload e horário.

F6/F7 acrescentam eventos como criação de evidência, vínculo de evidência a versão de protocolo e registro de ponto anatômico.

## Invariantes centrais

1. `ProtocolVersion` é imutável.
2. Sessão aponta para a versão exata do protocolo utilizada.
3. Planejado e aplicado são snapshots separados.
4. Alteração entre planejado/aplicado exige justificativa.
5. Adaptação por equipamento não altera o protocolo de referência.
6. Potência variável não é escolhida automaticamente.
7. Consentimentos preservam histórico append-only.
8. Pontos de aplicação preservam histórico imutável.
9. Documento finalizado é imutável.
10. Auditoria é append-only e verificável.
11. Outcome registra profissional e tempo da medida.
12. Comparação longitudinal não diagnostica e não atribui causalidade ao tratamento.
13. Evidência científica é referência documental e não altera silenciosamente parâmetros de protocolo.
14. Um vínculo de evidência aponta para uma versão exata, preservando a versão científica/profissional original.
15. O mapa corporal registra apenas localização confirmada pelo profissional; não sugere ponto, protocolo, dose ou conduta.
16. Coordenadas anatômicas F7 pertencem a uma sessão real por meio de `ApplicationPoint` e não substituem o registro clínico da aplicação.
