# Testes Clarinet - Bitcoin Yield Copilot

Este diretório contém testes unitários e de integração para os contratos Clarity do Bitcoin Yield Copilot.

## 📋 Requisitos

- [Clarinet](https://github.com/hirosystems/clarinet) instalado
- Deno (para executar testes TypeScript)

## 🚀 Comandos

### Verificar sintaxe dos contratos
```bash
clarinet check
```

### Executar todos os testes
```bash
clarinet test
```

### Executar testes específicos
```bash
# Testes do ALEX Adapter
clarinet test --filter alex-adapter

# Testes com output detalhado
clarinet test --coverage
```

### Testar contra testnet
```bash
# Console interativo na testnet
clarinet console --testnet
```

## 📁 Estrutura

```
tests/
├── alex-adapter-testnet-v2_test.ts    # Testes do ALEX Adapter
├── user-wallet_test.ts                 # Testes da User Wallet (TODO)
├── wallet-factory_test.ts              # Testes da Wallet Factory (TODO)
└── README.md                           # Este arquivo
```

## 🔧 Configuração

O arquivo `Clarinet.toml` está configurado com:
- **Production contracts**: Contratos reais do projeto
- **Mock contracts**: Simulações de protocolos externos (ALEX) para testes

## 🧪 Mock Contracts

Para testar sem depender da rede:

| Mock | Descrição |
|------|-----------|
| `mock-sip-010.clar` | Token SIP-010 para testes |
| `mock-alex-swap-helper.clar` | Simulação do swap helper da ALEX |
| `mock-alex-fixed-pool.clar` | Simulação do pool de liquidez da ALEX |
| `mock-alex-vault.clar` | Simulação do vault da ALEX |

## 📝 Escrevendo Novos Testes

```typescript
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.5.4/index.ts';

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

## 🐛 Debug

Habilite logs detalhados:
```bash
DEBUG=1 clarinet test
```
