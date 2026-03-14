# USDCx Adapter - Contract Flow

```mermaid
flowchart TD
    A[User executes action] --> B{Action = deposit?}
    B -->|Yes| C[Transfer USDCx from user to adapter]
    C --> D[Update user balance]
    D --> E[Update total allocated]
    E --> F[Return: amount, allocated]
    
    B -->|No| G{Action = withdraw?}
    G -->|Yes| H{Has sufficient balance?}
    H -->|No| I[Error: ERR-INSUFFICIENT-BALANCE]
    H -->|Yes| J[Update user balance]
    J --> K[Update total allocated]
    K --> L[Transfer USDCx from adapter to user]
    L --> M[Return: amount, allocated]
    
    G -->|No| N[Return: amount=0, allocated]
    
    O[User emergency withdraws] --> P[Get total balance]
    P --> Q[Reset total allocated]
    Q --> R[Reset user balance]
    R --> S[Transfer all USDCx to user]
    S --> T[Return: balance]
    
    U[Someone adds rewards] --> V[Update pending rewards]
    V --> W[Return: ok true]
    
    X[User claims rewards] --> Y{Has rewards?}
    Y -->|No| Z[Error: ERR-INSUFFICIENT-BALANCE]
    Y -->|Yes| AA[Reset pending rewards]
    AA --> AB[Transfer rewards to user]
    AB --> AC[Return: rewards amount]
```

## Function Summary

| Function | Description | Authentication |
|---------|-------------|----------------|
| `execute` | Deposit or withdraw USDCx | Via user-wallet |
| `get-balance` | Get total allocated | Public |
| `get-user-balance` | Get user balance | Public |
| `get-pending-rewards` | Get pending rewards | Public |
| `emergency-withdraw` | Emergency withdraw all funds | Owner only |
| `add-rewards` | Add rewards to pool | External |
| `claim-rewards` | Claim earned rewards | User |

## Data Structures

### user-balances (map)
- Tracks USDCx balance per user

## State Variables

- `total-allocated`: Total USDCx in adapter
- `pending-rewards`: Pending rewards to be claimed

## Error Codes

| Code | Meaning |
|------|---------|
| `ERR-INSUFFICIENT-BALANCE` | User has insufficient balance |

## Integration with User Wallet

```mermaid
sequenceDiagram
    participant U as User
    participant W as User Wallet
    participant A as USDCx Adapter
    
    U->>W: Execute (deposit, amount)
    W->>A: execute(amount, "deposit")
    A->>A: Transfer USDCx from W to A
    A->>A: Update balances
    A-->>W: {amount, allocated}
    W-->>U: Success
```
