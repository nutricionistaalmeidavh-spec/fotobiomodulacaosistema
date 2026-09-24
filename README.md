# ArtiSys Fotobiomodulação

Sistema clínico especializado em fotobiomodulação, local/self-hosted, construído por fases com rastreabilidade clínica e sem dependência obrigatória de SaaS ou API paga.

## Estado atual — F0 a F10

A implementação cobre:

- autenticação local e profissionais;
- pacientes, anamnese, avaliações, atendimentos e histórico clínico;
- protocolos estruturados com versionamento imutável;
- dosimetria PBM determinística a partir dos valores informados pelo profissional;
- equipamentos e aplicadores com adaptação explícita ao equipamento real;
- consentimentos append-only;
- sessões PBM com parâmetros planejados e aplicados separados;
- pontos de aplicação e mapa corporal estruturado;
- imagens clínicas locais com SHA-256;
- PDF clínico finalizado e imutável;
- backup SQLite consistente via `VACUUM INTO` + manifesto SHA-256;
- evolução longitudinal e comparação descritiva;
- biblioteca científica local vinculada a versões exatas de protocolo;
- busca clínica avançada determinística com filtros estruturados e contraindicações;
- agenda, pacotes de tratamento, pagamentos e relatórios operacionais;
- clínica local, contas multi-profissionais e RBAC no servidor;
- gestão/revogação de sessões autenticadas;
- verificação operacional de integridade, backup administrativo e pré-validação de restauração;
- política de retenção de mídia voltada a revisão, sem exclusão automática;
- auditoria append-only com cadeia de integridade verificável;
- UI responsiva com superfícies condicionadas ao papel autenticado;
- testes unitários/domain/HTTP, E2E Chromium e smoke em CI.

## Fases implementadas

### F0 — Fundação técnica e domínio
SQLite local, migrations versionadas, versões imutáveis de protocolo, snapshots planejado/aplicado e auditoria encadeada.

### F1 — Paciente e prontuário
Autenticação local, cadastro não destrutivo de pacientes, anamnese, avaliação, atendimento e histórico longitudinal.

### F2 — Protocolos e dosimetria
Biblioteca estruturada por condição, sintoma, região, objetivo terapêutico e fase clínica. Relações determinísticas:

- `Energia (J) = Potência (mW) / 1000 × tempo (s)`
- `Fluência (J/cm²) = Energia (J) / área (cm²)`
- `Irradiância (mW/cm²) = Potência (mW) / área (cm²)`

Valores derivados inconsistentes são rejeitados em vez de corrigidos silenciosamente.

### F3 — Equipamentos e adaptação
Equipamentos/aplicadores registram capacidades reais. A adaptação mantém `referenceParameters` separados de `equipmentDerivedParameters`; o protocolo de referência nunca é sobrescrito. Potência variável exige escolha explícita do profissional.

### F4 — MVP clínico
Consentimento, mídia clínica, pontos de aplicação, evolução básica, PDF, backup verificado e auditoria do fluxo clínico local.

### F5 — Evolução longitudinal
Desfechos canônicos de dor VAS/EVA, funcional numérico, edema, ROM e evolução textual. Séries e comparações são descritivas e não atribuem causalidade ao tratamento.

### F6 — Biblioteca científica
Referências científicas locais podem ser vinculadas a uma `ProtocolVersion` exata como `supports`, `context` ou `contradicts`. O vínculo é documental, auditado e não altera dose ou protocolo.

### F7 — Mapa corporal
Catálogo anatômico e SVG local para registrar região, vista, lateralidade e coordenadas confirmadas pelo profissional em uma sessão real. Não sugere ponto, protocolo ou dose.

### F8 — Motor clínico avançado
Busca determinística sobre protocolos estruturados com filtros por:

- condição e sintoma;
- região e objetivo;
- fase clínica;
- idade;
- área profissional;
- comprimento de onda;
- aplicador real.

Cada resultado mantém a versão exata, indicações, contraindicações/precauções e compatibilidade determinística do equipamento. Não há score terapêutico, ranking ou prescrição automática.

### F9 — Operação clínica
Adiciona:

- agenda e recorrência materializada em compromissos explícitos;
- pacotes de tratamento;
- consumo explícito de sessão PBM real em pacote;
- pagamentos em centavos inteiros;
- receita recebida/pendente;
- relatórios descritivos por período, profissional e equipamento.

Concluir um compromisso não cria sessão clínica automaticamente e registrar pagamento não altera prontuário ou protocolo.

### F10 — Multi-profissional, RBAC e robustez
A instalação possui uma clínica local e memberships com papéis:

- **Administrador** — acesso completo, gestão de contas/sessões, auditoria e backup;
- **Profissional** — pacientes, prontuário, agenda, protocolos e leitura de equipamentos;
- **Recepção** — cadastro de pacientes, agenda e financeiro, sem acesso ao prontuário/protocolos.

A autorização é validada pelo servidor. F10 também inclui revogação de sessões, desativação imediata de conta, `PRAGMA integrity_check`, verificação da cadeia de auditoria, detecção de referências operacionais órfãs, backup administrativo verificado, pré-validação de restauração para destino explícito e política de retenção de mídia sem deleção automática.

## Roadmap

O roadmap funcional canônico **encerra em F10**. Não existe F11 substituta planejada. A decisão está registrada em `docs/decisions/0002-roadmap-ends-f10-no-ai-rag.md`.

## Limites clínicos de segurança

1. O sistema não prescreve automaticamente.
2. O sistema não escolhe dose terapêutica pelo profissional.
3. Dosimetria é determinística e parte de parâmetros informados/selecionados pelo profissional.
4. `ProtocolVersion` nunca é sobrescrita.
5. Mudança clínica cria uma nova versão.
6. Sessão aponta para a versão exata utilizada.
7. Planejado e aplicado permanecem separados.
8. Divergência entre planejado/aplicado exige justificativa profissional.
9. Consentimentos e auditoria preservam histórico append-only.
10. Documento clínico finalizado é imutável.
11. Evolução longitudinal não diagnostica nem atribui causalidade.
12. Evidência científica é referência documental.
13. Body map registra localização confirmada, sem sugerir tratamento.
14. Busca F8 não atribui ranking terapêutico.
15. Agenda F9 não cria automaticamente aplicação PBM.
16. Pacote F9 só consome sessão clínica real e explicitamente selecionada.
17. RBAC F10 é validado no servidor, não pela visibilidade da UI.
18. Política de retenção F10 apenas lista candidatos para revisão; não exclui mídia automaticamente.

## Core R$ 0 / self-hosted

- **Runtime:** Node.js 22+.
- **Banco:** SQLite via `node:sqlite`.
- **Servidor/UI:** HTTP + HTML/CSS/JavaScript nativos.
- **Arquivos clínicos:** armazenamento local.
- **PDF:** geração local.
- **Biblioteca científica e busca clínica:** SQLite local.
- **Mapa corporal:** SVG/JavaScript local.
- **Agenda/financeiro/RBAC:** persistência local.
- **Backup:** snapshot SQLite + arquivos + manifesto de integridade.
- **E2E:** Playwright somente como dependência de desenvolvimento.
- **CI:** GitHub Actions é conveniência do repositório, não requisito do produto.

## Executar

```bash
npm install
npm run dev
```

Por padrão, a aplicação usa `http://127.0.0.1:8788` e o banco persistente fica em `data/fotobiomodulacao.sqlite`.

## Verificação

```bash
npm run check
npm run test:unit
npx playwright install chromium
npm run test:e2e
npm run smoke
```

A suíte cobre regressão F0–F10 e os fluxos críticos de autenticação, prontuário, protocolo/dosimetria, equipamento/adaptação, sessão PBM, consentimento, mídia/PDF/backup, evolução, evidência, body map, busca F8, operação F9, RBAC e administração F10.

Documentação técnica adicional está em `docs/`.
