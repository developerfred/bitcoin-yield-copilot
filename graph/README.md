# Graph - Diagramas de Fluxo dos Contratos

Este diretório contém diagramas de fluxo para todas as interações dos contratos Clarity do Bitcoin Yield Copilot.

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| [wallet-factory.md](wallet-factory.md) | Fluxos de registro, ativação e desativação de wallets |
| [user-wallet.md](user-wallet.md) | Fluxos de inicialização, execução, saque e emergências |
| [withdraw-helper.md](withdraw-helper.md) | Fluxos de autorização e consumo de saques |
| [alex-adapter.md](alex-adapter.md) | Fluxos de deposit, withdraw e liquidez |
| [architecture.md](architecture.md) | Visão geral da interação entre contratos |

## Como Visualizar

### VS Code (Recomendado)
1. Instale a extensão "Markdown Preview Mermaid Support"
2. Abra qualquer arquivo `.md` e visualize com `Ctrl+Shift+V`

### Online
- [Mermaid Live Editor](https://mermaid.live/)
- Copie o código entre \`\`\`mermaid e \`\`\`

### Ferramentas CLI
```bash
# Instale mermaid-cli
npm install -g @mermaid-js/mermaid-cli

# Generate PNG
mmdc -i graph/wallet-factory.md -o graph/wallet-factory.png
```

## Contratos Principais

```
contracts/
├── wallet-factory.clar     → [wallet-factory.md]
├── user-wallet.clar       → [user-wallet.md]
├── withdraw-helper.clar   → [withdraw-helper.md]
├── adapter-trait.clar    → [alex-adapter.md]
└── alex-adapter.clar      → [alex-adapter.md]
```
