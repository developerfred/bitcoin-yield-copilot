# Withdraw Helper - Fluxo de Inicialização e Configuração

```mermaid
flowchart TD
    A[Owner inicia transação] --> B{tx-sender é owner?}
    B -->|Não| C[Erro: ERR-NOT-AUTHORIZED]
    B --> D{bot-pubkey é zero?}
    D -->|Não| E[Erro: ERR-ALREADY-INITIALIZED]
    D --> F{bot-pk válido?}
    F -->|Não| G[Erro: ERR-INVALID-PUBKEY]
    F --> H[Armazena bot-pubkey]
    H --> I[Emite evento initialized]
    I --> J[Retorna: ok true]
```

# Withdraw Helper - Registro de Wallet

```mermaid
flowchart TD
    A[Owner registra wallet] --> B{tx-sender é owner?}
    B -->|Não| C[Erro: ERR-NOT-AUTHORIZED]
    B --> D{wallet já existe?}
    D -->|Sim| E[Erro: ERR-ALREADY-INITIALIZED]
    D --> F{max-per-tx > 0?}
    F -->|Não| G[Erro: ERR-INVALID-LIMITS]
    F --> H{daily-limit > 0?}
    H -->|Não| G
    H --> I{max-per-tx <= daily-limit?}
    I -->|Não| G
    I --> J{telegram-hash válido?}
    J -->|Não| K[Erro: ERR-INVALID-PUBKEY]
    J --> L[Armazena wallet data]
    L --> M[Armazena spending-limits]
    M --> N[Emite evento wallet-registered]
    N --> O[Retorna: ok true]
```

# Withdraw Helper - Autorização de Saque

```mermaid
flowchart TD
    A[Bot autoriza saque] --> B{pausado?}
    B -->|Sim| C[Erro: ERR-PAUSED]
    B --> D{wallet revogada?}
    D -->|Sim| E[Erro: ERR-WALLET-REVOKED]
    D --> F{amount > 0?}
    F -->|Não| G[Erro: ERR-ZERO-AMOUNT]
    F --> H{amount >= MIN?}
    H -->|Não| I[Erro: ERR-AMOUNT-TOO-SMALL]
    H --> J{recipient válido?}
    J -->|Não| K[Erro: ERR-INVALID-RECIPIENT]
    J --> L{nonce correto?}
    L -->|Não| M[Erro: ERR-EXPIRED]
    L --> N{tg-proof válido?}
    N -->|Não| O[Erro: ERR-NOT-AUTHORIZED]
    N --> P{block expirado?}
    P -->|Sim| Q[Erro: ERR-EXPIRED]
    P --> R{assinatura válida?}
    R -->|Não| S[Erro: ERR-INVALID-SIGNATURE]
    R --> T{auth-key já existe?}
    T -->|Sim| U[Erro: ERR-AUTH-EXISTS]
    T --> V[Verifica daily limit]
    V --> W{within limits?}
    W -->|Não| X[Erro: ERR-DAILY-LIMIT]
    W --> Y[Verifica rate limit]
    Y -->|Erro| Z[Erro: ERR-RATE-LIMIT]
    Y -->|Ok| AA[Cria pending-auth]
    AA --> AB[Emite evento withdrawal-authorized]
    AB --> AC[Retorna: {recipient, amount, auth-key}]
```

# Withdraw Helper - Consumo de Autorização

```mermaid
flowchart TD
    A[User wallet consome auth] --> B{auth existe?}
    B -->|Não| C[Erro: ERR-NOT-AUTHORIZED]
    B --> D{tx-sender = wallet?}
    D -->|Não| E[Erro: ERR-NOT-AUTHORIZED]
    D --> F{wallet = auth.wallet?}
    F -->|Não| E
    F --> G{recipient = auth.recipient?}
    G -->|Não| E
    G --> H{amount = auth.amount?}
    H -->|Não| E
    I{block <= expiry?}
    I -->|Não| J[Erro: ERR-EXPIRED]
    I --> K[Avança nonce]
    K --> L[Debita spending limit]
    L --> M[Remove pending-auth]
    M --> N[Calcula taxa]
    N --> O[Emite evento authorization-consumed]
    O --> P[Retorna: {net-amount, fee-amount, treasury}]
```

# Withdraw Helper - Fluxo Completo de Saque

```mermaid
sequenceDiagram
    participant U as Usuário
    participant B as Bot
    participant WH as Withdraw Helper
    participant UW as User Wallet
    participant T as Treasury

    U->>B: Solicita saque
    B->>WH: authorize-withdrawal()
    WH->>WH: Valida parâmetros
    WH->>WH: Cria pending-auth
    WH-->>B: {recipient, amount, auth-key}
    B->>U: Confirma autorização
    U->>UW: Chama withdraw-stx/withdraw-token()
    UW->>WH: consume-authorization()
    WH->>WH: Valida auth-key
    WH->>WH: Debita limites
    WH->>WH: Remove pending-auth
    WH-->>UW: {net-amount, fee-amount, treasury}
    UW->>U: Transfere net-amount
    UW->>T: Transfere fee-amount (opcional)
```

# Withdraw Helper - Funções Públicas

| Função | Descrição | Autenticação |
|--------|-----------|---------------|
| `initialize` | Inicializa o contrato | Apenas owner |
| `set-fee` | Configura taxa de saque | Owner assinado, nonce |
| `register-wallet` | Registra nova wallet | Apenas owner |
| `update-wallet-limits` | Atualiza limites | Apenas owner |
| `revoke-wallet` | Revoga wallet | Apenas owner |
| `unrevoke-wallet` | Remove revogação | Apenas owner |
| `emergency-pause` | Pausa saques | Owner assinado, nonce |
| `emergency-unpause` | Despausa saques | Owner assinado, nonce |
| `authorize-withdrawal` | Autoriza saque | Bot assinado, tg-proof |
| `consume-authorization` | Consome autorização | Apenas user-wallet |
