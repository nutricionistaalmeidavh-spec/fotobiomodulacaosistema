# Modelo de domínio F0

## Núcleo clínico

### Professional
Profissional responsável por avaliações, sessões, documentos e atos auditáveis.

### Patient
Paciente como raiz do histórico clínico.

### Assessment
Avaliação/anamnese vinculada ao paciente e profissional.

### Encounter
Atendimento clínico. Sessões, documentos, mídia e evolução podem apontar para ele.

## Fotobiomodulação

### Protocol
Identidade estável do protocolo.

### ProtocolVersion
Snapshot imutável. Guarda origem, referência, racional e parâmetros estruturados em JSON até o motor de dosimetria F2 transformar esses campos em contratos mais específicos.

### ProtocolIndication
Liga uma versão a condição, sintoma, região anatômica e objetivo terapêutico.

### ProtocolContraindication
Precauções/contraindicações rastreáveis por versão e fonte.

### Equipment / Applicator
Representa equipamento real e aplicador/ponteira, incluindo comprimento de onda, potência máxima, área de spot e modos.

### TreatmentSession
Registro da sessão realizada. Mantém `planned_parameters_json` e `applied_parameters_json` separados.

### ApplicationPoint
Ponto/área individual da sessão, preparado para o body map futuro.

### Outcome
Métrica/evolução longitudinal do paciente.

## Evidência e governança

### ClinicalMedia
Arquivo clínico referenciado por caminho de storage; o core não obriga cloud storage.

### Consent
Versão do consentimento, status e evidência de aceite/revogação.

### Document
Documento clínico em rascunho/finalizado/anulado.

### AuditEvent
Evento append-only com suporte a `prev_hash` e `event_hash` para cadeia verificável.
