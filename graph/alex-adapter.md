# Adapter Trait - Interface Comum

```mermaid
classDiagram
    class AdapterTrait {
        <<trait>>
        +execute(uint, string) → Response
        +get-balance() → Response
    }

    class AlexAdapter {
        +execute(uint, string)
        +get-balance()
        +add-liquidity-fixed(token, uint, uint, uint)
        +add-liquidity-simple(token, uint, uint, uint)
        +remove-liquidity(pool, token, token, uint, uint, uint)
        +add-to-vault(token, uint)
        +get-stx-balance()
    }

    class ZestAdapter {
        +execute(uint, string)
        +get-balance()
    }

    AdapterTrait <|-- AlexAdapter
    AdapterTrait <|-- ZestAdapter
```

# Alex Adapter - Fluxo de Execute (Deposit/Withdraw)

```mermaid
flowchart TD
    A[User Wallet chama execute] --> B{amount > 0?}
    B -->|Não| C[Erro: ERR-INVALID-AMOUNT]
    B --> D{ação = deposit?}
    D -->|Sim| E[Recebe STX para adapter]
    E --> F[Atualiza total-allocated]
    F --> G[Retorna: {amount, allocated}]
    D -->|Não| H{ação = withdraw?}
    H -->|Não| I[Erro: ERR-INVALID-ACTION]
    H --> J{balance >= amount?}
    J -->|Não| K[Erro: ERR-INSUFFICIENT-BALANCE]
    J --> L[Transfere STX para wallet]
    L --> M[Atualiza total-allocated]
    M --> G
```

# Alex Adapter - Adicionar Liquidez (Fixed)

```mermaid
flowchart TD
    A[Usuário chama add-liquidity-fixed] --> B{ dx > 0 e dy > 0? }
    B -->|Não| C[Erro: ERR-INVALID-AMOUNT]
    B --> D[Aprova TOKEN-WSTX]
    D --> E[Aprova token-y]
    E --> F[Chama add-to-position]
    F --> G{sucesso?}
    G -->|Erro| H[Erro: ERR-ALEX-FAILED]
    G -->|Ok| I[Retorna resultado]
```

# Alex Adapter - Adicionar ao Vault

```mermaid
flowchart TD
    A[Usuário chama add-to-vault] --> B{amount > 0?}
    B -->|Não| C[Erro: ERR-INVALID-AMOUNT]
    B --> D[Aprova token]
    D --> E[Chama add-to-balance]
    E --> F{sucesso?}
    F -->|Erro| G[Erro: ERR-ALEX-FAILED]
    F -->|Ok| H[Retorna resultado]
```

# Alex Adapter - Fluxo de Integração Completo

```mermaid
sequenceDiagram
    participant U as Usuário
    participant UW as User Wallet
    participant AA as Alex Adapter
    participant ALEX as Contratos ALEX

    U->>UW: execute-authorized-operation
    UW->>AA: execute(amount, "deposit")
    AA->>AA: stx-transfer? para si mesmo
    AA->>AA: Atualiza total-allocated
    AA-->>UW: {amount, allocated}
    UW-->>U: Confirma depósito

    Note over U,UW: Para liquidez avançada:
    U->>AA: add-liquidity-fixed
    AA->>AA: approve TOKEN-WSTX
    AA->>AA: approve token-y
    AA->>ALEX: FIXED-WEIGHT-POOL.add-to-position
    ALEX-->>AA: resultado
    AA-->>U: shares obtidas
```

# Alex Adapter - Funções Públicas

| Função | Descrição | Requerimentos |
|--------|-----------|---------------|
| `execute` | Deposit/Withdraw básico | amount > 0 |
| `get-balance` | Retorna total alocado | - |
| `add-liquidity-fixed` | Adiciona liquidez com pesos fixos | dx, dy > 0, aprovações |
| `add-liquidity-simple` | Adiciona liquidez simples | dx, dy > 0, aprovações |
| `remove-liquidity` | Remove liquidez | 0 < percent <= 100 |
| `add-to-vault` | Adiciona ao vault | amount > 0, aprovação |
| `get-stx-balance` | Retorna balance STX | - |
