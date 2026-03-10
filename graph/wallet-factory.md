# Wallet Factory - Fluxo de Registro

```mermaid
flowchart TD
    A[Usuário Telegram] --> B[Bot cria transação]
    B --> C{wallet já existe?}
    C -->|Sim| D[Erro: ERR-ALREADY-EXISTS]
    C -->|Não| E[Factory verifica assinatura]
    E --> F{assinatura válida?}
    F -->|Não| G[Erro: ERR-INVALID-SIG]
    F -->|Sim| H[Verifica nonce]
    H --> I{nonce correto?}
    I -->|Não| J ERR-NOT-A[Erro:UTHORIZED]
    I -->|Sim| K[Registra wallet no map]
    K --> L[Atualiza total-wallets]
    L --> M[Incrementa factory-nonce]
    M --> N[Retorna: wallet-contract]
    N --> O[Bot confirma registro]
```

# Wallet Factory - Fluxo de Ativação/Desativação

```mermaid
flowchart TD
    A[Bot envia transação] --> B{wallet existe?}
    B -->|Não| C[Erro: ERR-NOT-FOUND]
    B --> D{nonce correto?}
    D -->|Não| E[Erro: ERR-NOT-AUTHORIZED]
    D --> F{block válido?}
    F -->|Não| G[Erro: ERR-NOT-AUTHORIZED]
    F --> H{assinatura válida?}
    H -->|Não| I[Erro: ERR-INVALID-SIG]
    H -->|Sim| J{ação: deactivate?}
    J -->|Sim| K[Define active: false]
    J -->|Não| L[Define active: true]
    K --> M[Incrementa nonce]
    L --> M
    M --> N[Atualiza map]
    N --> O[Retorna: ok true]
```

# Wallet Factory - Funções Públicas

| Função | Descrição | Requerimentos |
|--------|-----------|---------------|
| `configure` | Configura a chave pública do bot | Apenas owner |
| `register-wallet` | Registra nova wallet para usuário | Bot assinado, nonce válido |
| `deactivate-wallet` | Desativa wallet | Bot assinado, nonce válido |
| `reactivate-wallet` | Reativa wallet | Bot assinado, nonce válido |
