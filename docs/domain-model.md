# Modelo de domínio — F0 a F10

## Núcleo clínico

### Professional
Profissional responsável por avaliações, sessões, documentos, outcomes e eventos auditáveis.

### Patient
Raiz do histórico clínico, com dados cadastrais e arquivamento não destrutivo.

### Assessment / Encounter
Avaliação/anamnese e ciclo do atendimento. Sessões, documentos, mídia e outcomes podem ser vinculados ao atendimento.

## Fotobiomodulação

### Protocol / ProtocolVersion
`Protocol` é a identidade estável. `ProtocolVersion` é snapshot imutável; qualquer mudança gera nova versão.

### ProtocolIndication
Relaciona uma versão a condição, sintoma, região, objetivo e fase clínica. F8 acrescenta restrições opcionais:

- `min_age_years`;
- `max_age_years`;
- `professional_area`.

Ausência desses campos não cria restrição presumida.

### ProtocolContraindication
Precaução/contraindicação pertencente à versão exata do protocolo.

### Equipment / Applicator
Representam equipamento e ponteira reais, incluindo comprimento de onda, potência fixa/faixa, área, modos e frequências.

### Equipment adaptation
Resultado derivado e separado:

- `referenceParameters` — versão imutável;
- `equipmentDerivedParameters` — cálculo para o aplicador selecionado;
- `warnings` — incompatibilidades/dados faltantes.

Potência variável exige escolha explícita do profissional.

### TreatmentSession
Aplicação real com protocolo/versão exatos e snapshots planejado/aplicado separados.

### ApplicationPoint / BodyMapPoint
Ponto aplicado em sessão real. F7 interpreta `coordinates_json` com `regionId`, vista, lateralidade e `x/y` normalizados. Body map não cria entidade terapêutica autônoma.

## Governança clínica

### Consent
Aceite/revogação versionados e append-only.

### ClinicalMedia
Mídia local com vínculo clínico, caminho e SHA-256.

### Document
Documento clínico; quando finalizado torna-se imutável.

### Outcome
Medida longitudinal vinculada ao paciente e opcionalmente a atendimento/sessão. Tipos canônicos incluem VAS 0–10, funcional numérico, edema, ROM e texto. Comparações são descritivas e não causais.

### EvidenceSource / ProtocolEvidenceLink
Referência científica local e vínculo documental a `ProtocolVersion` exata (`supports`, `context`, `contradicts`). Não altera parâmetros clínicos.

## F8 — consulta clínica avançada

F8 não cria uma entidade terapêutica nova. `searchClinicalProtocols()` projeta dados já persistidos:

- protocolo e versão atual;
- indicações estruturadas;
- faixa etária/área profissional opcionais;
- contraindicações/precauções da versão;
- compatibilidade determinística com aplicador quando solicitado.

O resultado não possui score terapêutico nem campo de recomendação automática.

## F9 — operação clínica

### Appointment
Compromisso operacional com paciente, profissional opcional, início/fim, tipo, status e série de recorrência opcional. Recorrências são materializadas em registros explícitos.

### TreatmentPackage
Pacote do paciente com nome, quantidade total de sessões, valor total em centavos, validade e status.

### PackageUsage
Vínculo explícito entre um pacote e uma `TreatmentSession` real. A mesma sessão não pode consumir o mesmo pacote duas vezes e deve pertencer ao mesmo paciente.

### Payment
Cobrança/pagamento com paciente, pacote opcional, valor inteiro em centavos, forma, status, vencimento e quitação.

### OperationsReport
Não é tabela. É projeção descritiva por período sobre agenda, sessões, protocolos, outcomes, pagamentos, profissionais e equipamentos.

## F10 — organização, autorização e robustez

### Clinic
Representa a instalação/clínica local. Pode definir `media_retention_days` para revisão de mídia.

### AuthAccount
Conta local com credenciais scrypt e status ativo. A coluna legada `role` permanece por compatibilidade.

### ClinicMembership
Fonte de verdade F10 para papel efetivo da conta na clínica:

- `admin`;
- `professional`;
- `reception`.

A membership possui estado ativo e é resolvida durante autenticação/sessão.

### AuthSession
Sessão local com token armazenado somente como hash. Administração lista apenas metadados; token/hash não é exposto. Revogação pode invalidar todas as sessões de uma conta.

### Permission
Não é persistida individualmente. A matriz canônica em `src/core/rbac.js` deriva permissões do papel e o HTTP server valida cada família de rota.

### OperationalIntegrity
Projeção de verificação composta por:

- `PRAGMA integrity_check`;
- integridade da cadeia de `AuditEvent`;
- contagens de referências operacionais órfãs.

### Backup / RestorePreview
Backup é snapshot consistente local com manifesto SHA-256. `RestorePreview` valida o backup e um destino explícito, sem substituir o banco aberto.

### MediaRetentionCandidate
Projeção de mídias anteriores ao limite configurado. É somente uma fila para revisão; nenhum registro/arquivo é apagado automaticamente.

## Auditoria

### AuditEvent
Evento append-only com `prev_hash` e `event_hash`. F8 é leitura determinística; F9/F10 auditam mutações operacionais e administrativas, incluindo snapshots anterior/posterior quando aplicável.

## Invariantes centrais

1. `ProtocolVersion` é imutável.
2. Sessão aponta para versão exata do protocolo.
3. Planejado e aplicado são snapshots separados.
4. Divergência exige justificativa profissional.
5. Adaptação de equipamento não altera protocolo de referência.
6. Potência variável não é escolhida automaticamente.
7. Consentimentos preservam histórico append-only.
8. Documento finalizado é imutável.
9. Auditoria é append-only e verificável.
10. Outcome não produz diagnóstico nem atribuição causal.
11. Evidência científica é documental.
12. Body map só registra localização confirmada.
13. Busca F8 não gera ranking, prescrição ou valor presumido.
14. Compromisso F9 não cria sessão PBM automaticamente.
15. PackageUsage exige sessão real e não admite duplicidade no pacote.
16. Valores monetários F9 usam centavos inteiros.
17. Membership F10 define o papel efetivo para autorização.
18. UI não é autoridade de permissão; o servidor é.
19. Conta desativada deixa de autenticar e suas sessões podem ser revogadas.
20. Senhas/tokens/hashes nunca são expostos em respostas administrativas.
21. Restauração não sobrescreve silenciosamente o banco aberto.
22. Retenção de mídia não implica deleção automática.

## Roadmap

O modelo funcional planejado termina em F10. Não existe uma F11 substituta no roadmap vigente.
