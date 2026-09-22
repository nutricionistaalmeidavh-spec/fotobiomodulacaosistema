# ADR-0001 — Core zero-cost e self-hosted

**Status:** aceito

## Decisão

Toda funcionalidade obrigatória do núcleo deve executar sem serviço pago e sem conta em provedor externo.

## Consequências

- SQLite local é o primeiro adaptador de persistência.
- Arquivos serão suportados por filesystem/object storage self-hosted antes de qualquer adapter comercial.
- autenticação local/open source deve existir antes de adapters OAuth opcionais;
- IA, mensagens, pagamentos, storage cloud e bancos gerenciados serão adapters opcionais;
- falha/ausência de serviço externo não pode impedir a operação clínica básica.
