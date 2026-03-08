# Carteira de Desenvolvimento - Stacks Testnet

## ⚠️ AVISO DE SEGURANÇA

**ESTA CARTEIRA É PARA AMBIENTE DE DESENVOLVIMENTO/TESTNET APENAS!**

- **NÃO** use esta chave em mainnet com fundos reais
- **NÃO** compartilhe esta chave privada
- **NÃO** commite este arquivo no repositório

---

## Dados da Carteira

| Campo | Valor |
|-------|-------|
| **Network** | Stacks Testnet |
| **Private Key (hex)** | `dbf681ac48e826a9a2ca37c4eff951da5e21a76d32da6aa321e6c25d03ab6ff901` |
| **Address (STX)** | `STQGY49KAA8NAJAH9ZNJCMDAMAGJ0YYNW0JCVC2Y` |

---

## Como Obter Tokens de Teste (Faucet)

### STX Testnet
1. Acesse o faucet: https://explorer.stacks.co/sandbox/deploy?chain=testnet
2. Ou use: https://stacksfaucet.com/

### sBTC Testnet
1. Primeiro obtenha STX do faucet
2. Use o sBTC bridge de teste: https://sbtc.bridge.sats.gg/

---

## Configuração no Projeto

Para usar esta carteira no ambiente de desenvolvimento, configure a variável de ambiente:

```bash
# No arquivo .env
STACKS_NETWORK=testnet
AGENT_STACKS_PRIVATE_KEY=dbf681ac48e826a9a2ca37c4eff951da5e21a76d32da6aa321e6c25d03ab6ff901
```

---

## Explorers de Testnet

- **Stacks Explorer**: https://explorer.stacks.co/?chain=testnet
- **Alex Lab**: https://testnet.alexlab.co/

---

*Gerado em: 2026-02-28*
