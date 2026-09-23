# Modelo de domínio — F0 a F5

## Núcleo clínico

### Professional
Profissional responsável por avaliações, sessões, consentimentos, documentos, outcomes e eventos auditáveis.

### Patient
Raiz do histórico clínico. Possui dados cadastrais, estado ativo/arquivado e relacionamentos com avaliações, atendimentos, sessões, mídia e evolução.

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
Ponto/local individual tratado durante uma sessão. Registra sequência, região/anatomia textual e parâmetros da aplicação. O histórico é imutável.

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
A timeline F5 agrega eventos clínicos persistidos, incluindo avaliações/atendimentos, sessões PBM, consentimentos, mídia, documentos e outcomes, mantendo ordenação temporal e identidade dos registros.

## Auditoria

### AuditEvent
Evento append-only com `prev_hash` e `event_hash` para cadeia SHA-256 verificável. Ações clínicas relevantes registram profissional, entidade, payload e horário.

## Invariantes centrais

1. ProtocolVersion é imutável.
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
