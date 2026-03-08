# API Module

This document describes the API module (`src/api/`) which provides REST endpoints.

## Overview

The API module provides HTTP endpoints for wallet authentication and key delivery.

## Files

### Auth (`auth.ts`)

Handles user authentication for the Telegram WebApp.

**Functions:**

- `authenticateUser(telegramData)`: Authenticates user from Telegram WebApp data
- `validateAuthToken(token)`: Validates authentication token
- `refreshToken(token)`: Refreshes expired token

### Key Delivery (`keyDelivery.ts`)

Handles secure delivery of wallet keys.

**Functions:**

- `deliverKey(userId, keyData)`: Delivers encrypted key to user
- `requestKeyDelivery(userId)`: Requests key delivery
- `confirmKeyDelivery(deliveryId)`: Confirms key was received

### API Entry (`index.ts`)

Main API router setup.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth | Authenticate user |
| POST | /auth/refresh | Refresh token |
| POST | /key/deliver | Request key delivery |
| POST | /key/confirm | Confirm key received |
| GET | /health | Health check |

## Authentication

The API uses token-based authentication:

1. User authenticates via Telegram WebApp
2. Server validates Telegram data
3. Server issues JWT token
4. Subsequent requests include token in header

## Error Responses

```json
{
  "error": "error_code",
  "message": "Human readable message"
}
```

Common error codes:

- `INVALID_TOKEN`: Token is invalid or expired
- `UNAUTHORIZED`: User not authenticated
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request parameters
