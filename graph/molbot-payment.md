# Molbot Payment - Contract Flow

```mermaid
flowchart TD
    A[User pays molbot] --> B{Get molbot from registry}
    B --> C{Molbot found?}
    C -->|No| D[Error: ERR-NOT-FOUND]
    C -->|Yes| E{Molbot active?}
    E -->|No| F[Error: ERR-MOLBOT-INACTIVE]
    E -->|Yes| G{Token = STX?}
    G -->|No| H[Error: ERR-INVALID-TOKEN]
    G -->|Yes| I[Transfer STX to molbot]
    I --> J[Record payment]
    J --> K[Increment user payment count]
    K --> L[Update molbot balance]
    L --> M[Increment payment nonce]
    M --> N[Return: payment-id, amount]
```

## Function Summary

| Function | Description | Authentication |
|---------|-------------|----------------|
| `pay-molbot` | Pay a molbot for service | Requires STX transfer |
| `get-payment` | Get payment details by sender and nonce | Public |
| `get-user-payment-count` | Get total payments by user | Public |
| `get-molbot-balance` | Get total balance earned by molbot | Public |
| `get-total-payments` | Get total payments processed | Public |

## Data Structures

### payments (map)
Key: `{ sender: principal, nonce: uint }`
- `recipient`: principal - Molbot address
- `amount`: uint - Payment amount
- `token`: string-ascii 8 - Payment token (STX, sBTC, USDCx)
- `service-data`: buff 256 - Service metadata
- `completed`: bool - Whether payment completed

### user-payment-counts (map)
- Tracks number of payments per user

### molbot-balances (map)
- Tracks total earnings per molbot

## Error Codes

| Code | Meaning |
|------|---------|
| `ERR-NOT-FOUND` | Molbot not in registry |
| `ERR-MOLBOT-INACTIVE` | Molbot is not active |
| `ERR-INVALID-TOKEN` | Token not supported |

## Integration

```mermaid
sequenceDiagram
    participant U as User
    participant P as Molbot Payment
    participant R as Molbot Registry
    
    U->>P: pay-molbot(molbot, amount, STX, data)
    P->>R: get-molbot(molbot)
    R-->>P: molbot-info
    P->>P: Validate active status
    P->>P: Transfer STX to molbot
    P->>P: Record payment
    P-->>U: {payment-id, amount}
```
