# ADR-004 — MessagingProvider e adapters externos

Status: decisão inicial; implementação pendente. Data: 2026-10-06.

## Context

WhatsApp inicialmente usará Evolution API. Regras comerciais, conversas e mensagens precisam sobreviver à troca de fornecedor e permitir testes sem acesso externo. ERP, email, storage e IA terão o mesmo problema de fronteira, com contratos diferentes.

## Decision

Messaging define porta `MessagingProvider` orientada a ações/resultados do CRM. Infrastructure fornece `EvolutionMessagingProvider`, injetado por composição. Domínio/controllers comerciais não chamam Evolution nem transportam payloads do fornecedor.

Channel representa canal comercial; WhatsAppInstance contém configuração técnica atual. Namespace de conexão + IDs externos mapeiam entidades sem prender Message à tabela do adapter. Webhooks são autenticados, persistidos e normalizados antes de efeitos comerciais. Mensagem inbound/outbound usa estados, dedupe, rastreamento e políticas de reconciliação.

Verificar versão/capacidades reais antes da implementação: assinatura/auth webhook, IDs, ordering, idempotency e status/query. Não presumir que API suporta envio exactly-once. Timeout ambíguo produz estado UNKNOWN; idempotency só quando comprovada, senão reconciliar ou tratar manualmente.

StorageProvider, EmailProvider, ERPProvider e AIProvider serão portas específicas quando houver consumidor. Não criar uma interface universal de integração com dezenas de métodos vazios. Credenciais ficam fora do domínio/Git/logs; testes de contrato usam dados sintéticos e sandbox.

## Alternatives Considered

- Chamar SDK/Evolution de controllers/services comerciais: menor começo, mas alto acoplamento, secrets dispersos e testes dependentes de rede.
- Microserviço de messaging: custo de operação/contratos distribuídos sem justificativa inicial.
- Framework genérico de provedores: abstração precoce que esconde capacidades/limitações de cada serviço.

## Consequences

Trocar fornecedor exige adapter, migração de mappings e testes, sem reescrever CRM. A porta não transforma limitações externas em garantias. Reconciliação e envio incerto continuam necessários. QR, payloads e anexos têm controles específicos de privacidade/SSRF.

Integração Evolution e qualquer conexão real não fazem parte desta entrega documental.
