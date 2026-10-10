# ArtiSys Fotobiomodulação

Sistema clínico especializado em fotobiomodulação, com core **R$ 0 / self-hosted / open source** e dados locais. A integração canônica F0–F10 usa uma única interface, `ClinicalDataGateway` e APIs persistentes — não existem duas interfaces clínicas de produção.

## Recursos integrados

- **Administração:** criação de conta local, login, papéis administrador/profissional/recepção, autorização RBAC no servidor, revogação de sessões, gestão de equipe, clínica, verificação operacional e backup.
- **Pacientes:** cadastro, anamnese, avaliações, atendimentos, histórico longitudinal e auditoria com integridade verificável.
- **Segurança:** C09 com revisão profissional explicitamente persistida, identificação do autor e registro histórico imutável; nenhuma liberação terapêutica automática.
- **Protocolos e dosimetria:** versões imutáveis, parâmetros determinísticos, histórico de versão exata usada na sessão e distinção entre parâmetros planejados e aplicados, com justificativa obrigatória para divergências.
- **Equipamentos:** inventário e aplicadores reais, adaptação explicitamente revisada pelo profissional; sem inferências clínicas ocultas.
- **Sessões e evolução:** registro de aplicação, mapa corporal, desfechos estruturados e gráficos descritivos, sem atribuição de causalidade.
- **Mídias e documentos:** arquivos clínicos armazenados localmente, imagem autenticada verificada por SHA-256, galeria e comparação por data, PDFs locais e backup de banco/arquivos.
- **Biblioteca científica:** referências e vínculos documentais com versões imutáveis de protocolo; busca determinística com contraindicações explícitas, sem ranking terapêutico.
- **Operação:** agenda, recorrência, pacotes, cobranças, pagamentos, relatórios F9 persistentes e financeiro com controle de acesso por perfil.

## Instalar e executar

Requer **Node.js 22+** e `npm` para inicialização, sem banco gerenciado, SaaS, APIs pagas ou serviço externo obrigatório.

```bash
npm install
npm run dev
```

Acesse `http://127.0.0.1:8788`. Na instalação limpa, crie a primeira conta administrativa pela interface. O banco SQLite fica em `data/fotobiomodulacao.sqlite` e as mídias no diretório clínico local.

**Dados de demonstração não são inseridos em produção.** Somente para laboratório, defina `PBM_DEMO_SEED=1` antes de iniciar uma instalação de testes. Não use esse modo com pacientes reais.

## Verificação

```bash
npm run check
npm run test:unit
npx playwright install chromium
npm run test:e2e
npm run smoke
```

A CI executa testes unitários e HTTP, autenticação/RBAC, regressão clínica F0–F10 e Playwright em desktop/mobile. Capturas de QA com dados sintéticos são disponibilizadas como artefatos do workflow.

## Regras de segurança e limites

1. A prescrição, elegibilidade, indicação clínica e revisão de dose pertencem ao profissional.
2. Calculadoras operam somente com parâmetros informados e não recomendam tratamento.
3. Versões de protocolo e parâmetros históricos de sessões nunca são alterados silenciosamente.
4. C09 é uma revisão profissional rastreável, não autorização clínica automática.
5. Consentimento local registrado **não equivale por si só a assinatura digital juridicamente comprovada**.
6. Imagens, prontuário e backups exigem proteção do computador/armazenamento, gestão de acesso e política de privacidade.
7. Antes de comercializar para uso clínico real, validar classificação regulatória aplicável, finalidade comercial, LGPD, instalação, recuperação efetiva do backup e fluxos com profissionais.

## Arquitetura

- Node.js com HTTP e `node:sqlite`; HTML, CSS e JavaScript módulos nativos; sem build obrigatório.
- `ClinicalDataGateway` centraliza adapters focados, com dados clínicos persistidos.
- O backend valida permissões; esconder menus não substitui autorização.
- `docs/integration-sources.md` registra as fontes canônicas de integração.
- `docs/decisions/` registra as decisões de arquitetura.

Licença de código-fonte: consulte [LICENSE](LICENSE). Distribuição comercial e suporte são decisões independentes da operação técnica local.
