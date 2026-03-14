# ERC-8004 Identity - Contract Flow

```mermaid
flowchart TD
    A[User starts registration] --> B{Identity already registered?}
    B -->|Yes| C[Error: ERR-ALREADY-REGISTERED]
    B -->|No| D[Store identity data]
    D --> E[Store capabilities]
    E --> F[Increment total identities]
    F --> G[Return: ok true]

    H[User updates identity] --> I{Identity exists?}
    I -->|No| J[Error: ERR-NOT-FOUND]
    I -->|Yes| K[Update domain]
    K --> L[Update capabilities]
    L --> M[Return: ok true]

    N[User sets active status] --> O{Identity exists?}
    O -->|No| P[Error: ERR-NOT-FOUND]
    O -->|Yes| Q[Update active flag]
    Q --> R[Return: ok true]

    S[User signs action] --> T{Identity exists?}
    T -->|No| U[Error: ERR-NOT-FOUND]
    T -->|Yes| V[Calculate action hash]
    V --> W[Increment nonce]
    W --> X[Return: action-hash, new nonce]
```

## Function Summary

| Function | Description | Authentication |
|---------|-------------|----------------|
| `register-identity` | Register new on-chain identity | None (first come first served) |
| `update-identity` | Update domain and capabilities | Must be identity owner |
| `set-active` | Toggle identity active status | Must be identity owner |
| `sign-action` | Sign an action with identity | Must be identity owner |
| `get-identity` | Get identity details | Public |
| `get-capabilities` | Get identity capabilities | Public |
| `is-active` | Check if identity is active | Public |
| `is-registered` | Check if address is registered | Public |
| `get-total-identities` | Get total registered identities | Public |

## Data Structures

### identities (map)
- `domain`: string-ascii 64 - Agent domain
- `nonce`: uint - Action counter for signatures
- `active`: bool - Whether identity is active
- `registered-at`: uint - Block height of registration

### identity-capabilities (map)
- List of up to 10 capability strings

## Error Codes

| Code | Meaning |
|------|---------|
| `ERR-NOT-FOUND` | Identity not registered |
| `ERR-ALREADY-REGISTERED` | Address already has identity |
