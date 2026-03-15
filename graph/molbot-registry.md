# Molbot Registry - Contract Flow

```mermaid
flowchart TD
    A[Molbot registers] --> B{Already registered?}
    B -->|Yes| C[Error: ERR-ALREADY-REGISTERED]
    B -->|No| D[Store molbot data]
    D --> E[Set active = true]
    E --> F[Set owner = tx-sender]
    F --> G[Increment total molbots]
    G --> H[Return: ok true]

    I[Molbot updates info] --> J{Molbot exists?}
    J -->|No| K[Error: ERR-NOT-FOUND]
    J -->|Yes| L{Is owner?}
    L -->|No| M[Error: ERR-NOT-AUTHORIZED]
    L -->|Yes| N[Update name]
    N --> O[Update description]
    O --> P[Update capability]
    P --> Q[Update price]
    Q --> R[Update payment token]
    R --> S[Return: ok true]

    T[Molbot sets active status] --> U{Molbot exists?}
    U -->|No| V[Error: ERR-NOT-FOUND]
    U -->|Yes| W{Is owner?}
    W -->|No| X[Error: ERR-NOT-AUTHORIZED]
    W -->|Yes| Y[Set active flag]
    Y --> Z[Return: ok true]

    AA[Molbot deactivates] --> AB{Molbot exists?}
    AB -->|No| AC[Error: ERR-NOT-FOUND]
    AB -->|Yes| AD{Is owner?}
    AD -->|No| AE[Error: ERR-NOT-AUTHORIZED]
    AD -->|Yes| AF[Set active = false]
    AF --> AG[Return: ok true]

    AH[Molbot reactivates] --> AI{Molbot exists?}
    AI -->|No| AJ[Error: ERR-NOT-FOUND]
    AI -->|Yes| AK{Is owner?}
    AK -->|No| AL[Error: ERR-NOT-AUTHORIZED]
    AK -->|Yes| AM[Set active = true]
    AM --> AN[Return: ok true]
```

## Function Summary

| Function | Description | Authentication |
|---------|-------------|----------------|
| `register-molbot` | Register new molbot | None (first come first served) |
| `update-molbot` | Update molbot information | Must be owner |
| `set-active` | Set active status | Must be owner |
| `deactivate` | Deactivate molbot | Must be owner |
| `reactivate` | Reactivate molbot | Must be owner |
| `get-molbot` | Get molbot details | Public |
| `get-molbot-price` | Get price for molbot service | Public |
| `is-registered` | Check if address is registered | Public |
| `is-active` | Check if molbot is active | Public |
| `get-total-molbots` | Get total registered molbots | Public |

## Data Structures

### molbots (map)
- `name`: string-ascii 64 - Molbot name
- `description`: string-ascii 256 - Molbot description
- `capability`: string-ascii 32 - Service capability (yield-optimizer, content-generator, etc.)
- `price-per-call`: uint - Price per service call
- `payment-token`: string-ascii 8 - Token accepted (STX, sBTC, USDCx)
- `active`: bool - Whether molbot is active
- `owner`: principal - Molbot owner address
- `registered-at`: uint - Block height of registration

## Error Codes

| Code | Meaning |
|------|---------|
| `ERR-NOT-FOUND` | Molbot not registered |
| `ERR-NOT-AUTHORIZED` | Not the molbot owner |
| `ERR-ALREADY-REGISTERED` | Address already has molbot |
