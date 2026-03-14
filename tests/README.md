# Testes Clarinet - Bitcoin Yield Copilot

Este diretório contém testes unitários e de integração para os contratos Clarity do Bitcoin Yield Copilot.

## 📋 Versões Suportadas

- **Clarinet 1.x/2.x**: Use `clarinet test`
- **Clarinet 3.x**: Use `bun test:clarinet`

## 🚀 Comandos

### Verificar sintaxe dos contratos
```bash
clarinet check
# ou
bunx clarinet check
```

### Executar testes (Clarinet 1.x/2.x)
```bash
clarinet test
```

### Executar testes (Clarinet 3.x)
```bash
bun test:clarinet
bun test:clarinet:watch    # modo watch
bun test:clarinet:coverage  # com coverage
```

### Testar contra testnet
```bash
# Console interativo na testnet
clarinet console --testnet

# Console interativo local
clarinet console
```

## 📁 Estrutura dos Testes

```
tests/
├── *_test.ts              # Testes Clarinet (legacy format)
├── *.test.ts              # Testes TypeScript/Vitest
├── deps.ts                # Dependências compartilhadas
└── README.md              # Este arquivo
```

## 🔧 Configuração

O arquivo `Clarinet.toml` está configurado com:
- **Production contracts**: Contratos reais do projeto
- **Mock contracts**: Simulações de protocolos externos (ALEX) para testes

### Arquivos de Configuração

| Arquivo | Descrição |
|---------|-----------|
| `Clarinet.toml` | Configuração dos contratos |
| `vitest.config.ts` | Configuração Vitest (TypeScript) |
| `vitest.clarinet.config.ts` | Configuração Vitest (Clarinet) |
| `deno.json` | Configuração Deno |

## 🧪 Mock Contracts

Para testar sem depender da rede:

| Mock | Descrição |
|------|-----------|
| `mock-sip-010.clar` | Token SIP-010 para testes |
| `mock-alex-swap-helper.clar` | Simulação do swap helper da ALEX |
| `mock-alex-fixed-pool.clar` | Simulação do pool de liquidez da ALEX |
| `mock-alex-vault.clar` | Simulação do vault da ALEX |

## 📝 Escrevendo Novos Testes (Clarinet 3.x)

```typescript
import { Clarinet, Tx, Chain, types } from './deps.ts';

Clarinet.test({
  name: 'Descrição do teste',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user = accounts.get('wallet_1')!;
    
    const block = chain.mineBlock([
      Tx.contractCall('contract-name', 'function-name', [types.uint(100)], user.address)
    ]);
    
    block.receipts[0].result.expectOk();
  }
});
```

## ⚠️ Notas Importantes

### Clarinet 3.x
- O comando `clarinet test` foi removido
- Use Vitest com `vitest-environment-clarinet`
- Execute: `bun test:clarinet`

### Problemas Conhecidos

1. **npm install falha**: Use `bun install` ao invés de `npm install`
2. **Testes não rodam com Deno**: Use Vitest com Clarinet SDK
3. **Tipo de retorno不一致**: Certifique-se que todas as branches retornam o mesmo tipo

## 🐛 Debug

Habilite logs detalhados:
```bash
DEBUG=1 bun test:clarinet
```
