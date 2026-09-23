# ArtiSys Fotobiomodulação

Sistema clínico especializado em fotobiomodulação, local/self-hosted, construído por fases com rastreabilidade clínica e sem dependência obrigatória de SaaS ou API paga.

## Estado atual — F0 a F7 concluídas

A implementação atual cobre:

- autenticação local e profissionais;
- pacientes, anamnese, avaliações, atendimentos e histórico clínico;
- protocolos estruturados com versionamento imutável;
- dosimetria PBM determinística a partir dos valores informados pelo profissional;
- equipamentos e aplicadores com adaptação explícita ao equipamento real;
- consentimentos append-only;
- sessões PBM com parâmetros planejados e aplicados separados;
- pontos de aplicação registrados de forma estruturada;
- imagens clínicas armazenadas localmente com SHA-256;
- documentos clínicos PDF finalizados e imutáveis;
- backup local consistente do SQLite via `VACUUM INTO`, arquivos clínicos e manifesto SHA-256;
- desfechos longitudinais, séries temporais e comparação descritiva;
- linha do tempo clínica unificada;
- biblioteca científica local, pesquisável e vinculada a versões exatas de protocolo;
- mapa corporal SVG local para registrar localização anatômica confirmada pelo profissional;
- auditoria append-only com cadeia de integridade verificável;
- UI responsiva, incluindo fluxo mobile;
- testes unitários/domain/HTTP, E2E Chromium e smoke em CI.

## Fases implementadas

### F0 — Fundação técnica e domínio

SQLite local, migrações versionadas, domínio clínico, versões imutáveis de protocolo, snapshots planejado/aplicado e auditoria encadeada.

### F1 — Paciente e prontuário

Autenticação local, cadastro não destrutivo de pacientes, anamnese, avaliação, atendimento e histórico longitudinal básico.

### F2 — Protocolos e dosimetria

Biblioteca estruturada por condição, sintoma, região corporal, objetivo terapêutico e fase clínica. Suporta parâmetros PBM como comprimento de onda, potência, tempo, área, energia, fluência, irradiância, modo, frequência, pontos e técnica.

Relações determinísticas usadas pelo sistema:

- `Energia (J) = Potência (mW) / 1000 × tempo (s)`
- `Fluência (J/cm²) = Energia (J) / área (cm²)`
- `Irradiância (mW/cm²) = Potência (mW) / área (cm²)`

Valores derivados inconsistentes são rejeitados em vez de corrigidos silenciosamente.

### F3 — Equipamentos e adaptação

Equipamentos/aplicadores registram fabricante, modelo, comprimento de onda, potência, área/spot, modos e frequências. A adaptação compara o protocolo de referência com o aplicador selecionado e calcula parâmetros derivados sem sobrescrever a versão científica/profissional do protocolo.

Quando o equipamento aceita uma faixa de potência, a potência precisa ser selecionada explicitamente pelo profissional; o sistema não escolhe a potência automaticamente.

### F4 — MVP clínico

Fecha o fluxo operacional local com consentimento, mídia clínica, pontos de aplicação, evolução básica, PDF clínico, backup verificado e auditoria do fluxo.

### F5 — Evolução longitudinal

Adiciona desfechos canônicos:

- dor VAS/EVA 0–10;
- funcional numérico;
- edema numérico com unidade;
- amplitude de movimento/ROM;
- evolução textual estruturada.

Cada desfecho pode ser vinculado ao paciente, atendimento e sessão, registra o profissional responsável e pode usar um grupo longitudinal (`baseline_group`) para séries comparáveis. A UI mostra os registros ao longo do tempo, comparação primeiro → último e gráfico local simples.

A comparação é **descritiva**. O sistema não afirma que uma mudança clínica foi causada pelo tratamento.

### F6 — Biblioteca científica

Adiciona uma biblioteca local de referências científicas com título, autores, ano, fonte, tipo de estudo, DOI/URL, resumo e metadados estruturados por condição, região corporal e comprimento de onda.

Uma referência pode ser vinculada a uma `ProtocolVersion` exata com relação documental `supports`, `context` ou `contradicts`. O vínculo é auditado e **não altera parâmetros do protocolo**, não gera ranking terapêutico e não recomenda dose.

### F7 — Mapa corporal

Adiciona um catálogo anatômico local e um mapa SVG com vistas anterior/posterior, região, lateralidade e coordenadas normalizadas. O profissional seleciona e confirma a localização aplicada em uma sessão real.

O registro reutiliza `application_points.coordinates_json`, preservando o histórico existente. O mapa corporal **não sugere ponto, protocolo, dose ou conduta**.

## Limites clínicos de segurança

1. O sistema não prescreve automaticamente.
2. O sistema não escolhe dose terapêutica pelo profissional.
3. Cálculos de dosimetria são determinísticos e partem dos parâmetros informados/selecionados pelo profissional.
4. Uma versão de protocolo nunca é sobrescrita ou apagada.
5. Mudanças de protocolo criam uma nova `ProtocolVersion`.
6. A sessão aponta para a versão exata utilizada.
7. Parâmetros planejados e aplicados permanecem separados.
8. Alterações entre planejado e aplicado exigem justificativa profissional.
9. Consentimentos e eventos de auditoria preservam histórico append-only.
10. Documentos clínicos finalizados são imutáveis.
11. Evolução longitudinal não produz diagnóstico nem inferência automática de causalidade.
12. Evidência científica é referência documental e não modifica silenciosamente o protocolo.
13. O mapa corporal registra localização confirmada pelo profissional e não sugere tratamento.

## Core R$ 0 / self-hosted

O runtime não exige serviço externo obrigatório.

- **Runtime:** Node.js 22+.
- **Banco:** SQLite via `node:sqlite`.
- **Servidor/UI:** HTTP + HTML/CSS/JavaScript nativos.
- **Arquivos clínicos:** armazenamento local configurável.
- **PDF:** geração local sem API externa.
- **Biblioteca científica:** persistência e busca locais em SQLite.
- **Mapa corporal:** SVG/JavaScript local, sem serviço externo.
- **Backup:** snapshot SQLite local + arquivos + manifesto de integridade.
- **E2E:** Playwright como dependência de desenvolvimento.
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

A suíte cobre regressão das fases anteriores e fluxos reais no navegador, incluindo autenticação, prontuário, protocolo/dosimetria, equipamento/adaptação, sessão PBM, consentimento, pontos de aplicação, mídia, PDF, backup, evolução longitudinal, biblioteca científica, vínculo de evidência, mapa corporal e auditoria.

Documentação técnica adicional está em `docs/`.
